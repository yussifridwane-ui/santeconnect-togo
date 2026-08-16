import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * 🧾 FACTURE INDIVIDUELLE (V2.5)
 * GET → détail complet (lignes + patient + en-tête établissement) pour affichage/impression.
 * PUT → { action: "pay", amount, method } : encaisse un paiement (T-Money, Flooz,
 *         espèces, carte). Statut recalculé automatiquement : unpaid → partial → paid.
 *         🔔 Notifications automatiques : caisse notifiée + patient prévenu quand soldé.
 * Aucune suppression : une facture émise ne se détruit jamais (règle comptable).
 */

const ROLES = ["admin", "secretary"];

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!ROLES.includes(session.role) && session.role !== "doctor") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
    await ensureMigrated();

    const { id } = await params;
    const inv = await pool.query(
      `SELECT i.*, pu.full_name AS patient_name, pu.phone AS patient_phone,
              p.record_number, f.name AS facility_name, f.address AS facility_address, f.phone AS facility_phone,
              s.name AS insurer_name, s.rate AS insurer_rate
       FROM invoices i
       LEFT JOIN insurers s ON s.id = i.insurer_id
       LEFT JOIN patients p ON p.id = i.patient_id
       LEFT JOIN users pu ON pu.id = p.user_id
       LEFT JOIN facilities f ON f.id = i.facility_id
       WHERE i.id = $1`,
      [parseInt(id)],
    );
    const row = inv.rows[0];
    if (!row) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
    if (session.role !== "admin" && session.facilityId && row.facility_id !== session.facilityId) {
      return NextResponse.json({ error: "Facture d'un autre établissement." }, { status: 403 });
    }

    const items = await pool.query(
      `SELECT kind, label, qty, unit_price_fcfa, total_fcfa FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [row.id],
    );
    return NextResponse.json({ invoice: row, items: items.rows });
  } catch (e) {
    console.error("invoice GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Accès réservé à la caisse (admin/secrétaire)." }, { status: 403 });
    }
    await ensureMigrated();

    const { id } = await params;
    const body = await request.json();
    if (body.action !== "pay") {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }
    const amount = Math.max(0, parseInt(body.amount) || 0);
    const method = ["tmoney", "flooz", "cash", "card"].includes(String(body.method))
      ? String(body.method) : "cash";
    if (amount <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const cur = await pool.query(
      `SELECT i.*, pu.id AS patient_user_id, pu.full_name AS patient_name
       FROM invoices i
       LEFT JOIN patients p ON p.id = i.patient_id
       LEFT JOIN users pu ON pu.id = p.user_id
       WHERE i.id = $1`,
      [parseInt(id)],
    );
    const inv = cur.rows[0];
    if (!inv) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });

    /* 🤝 V2.7 : « l'assureur a payé sa part » — la facture devient soldée si
       le patient a déjà payé SA part. */
    if (body.action === "settle-insurer") {
      if (Number(inv.insurer_share_fcfa || 0) === 0 || inv.insurer_status !== "a_reclamer") {
        return NextResponse.json({ error: "Aucune part assureur à régler sur cette facture." }, { status: 400 });
      }
      const partPatient = Number(inv.total_fcfa) - Number(inv.insurer_share_fcfa);
      const newStatus = (inv.paid_fcfa || 0) >= partPatient ? "paid" : inv.status;
      await pool.query(
        `UPDATE invoices SET insurer_status = 'reglee', insurer_settled_at = now(), status = $1, updated_at = now()
         WHERE id = $2`,
        [newStatus, inv.id],
      );
      await audit(session, {
        action: "modifier", entity: "facture", entityId: inv.id, patientId: inv.patient_id,
        detail: `Assureur a réglé sa part — ${inv.care_sheet_number || inv.number} (${inv.insurer_share_fcfa} FCFA)`,
      });
      return NextResponse.json({ ok: true, status: newStatus });
    }

    if (inv.status === "paid") {
      return NextResponse.json({ error: "Cette facture est déjà soldée." }, { status: 400 });
    }

    /* Avec tiers payant, le PATIENT ne paie que SA part (total - part assureur).
       « Soldée » = part patient payée + (pas d'assureur OU assureur réglé). */
    const patientShare = Number(inv.total_fcfa) - Number(inv.insurer_share_fcfa || 0);
    const newPaid = Math.min(patientShare, (inv.paid_fcfa || 0) + amount);
    const insurerOk = Number(inv.insurer_share_fcfa || 0) === 0 || inv.insurer_status === "reglee";
    const newStatus = newPaid >= patientShare && insurerOk ? "paid" : "partial";
    await pool.query(
      `UPDATE invoices SET paid_fcfa = $1, status = $2, method = $3, updated_at = now() WHERE id = $4`,
      [newPaid, newStatus, method, inv.id],
    );

    const methodLabel = { tmoney: "T-Money", flooz: "Flooz", cash: "Espèces", card: "Carte" }[method as "tmoney" | "flooz" | "cash" | "card"];

    /* 🔔 Notifications automatiques : patient prévenu (soldé) + trace caisse */
    try {
      if (inv.patient_user_id) {
        await pool.query(
          `INSERT INTO notifications (user_id, facility_id, type, title, body, link)
           VALUES ($1,$2,'paiement',$3,$4,'/dashboard')`,
          [
            inv.patient_user_id,
            inv.facility_id,
            newStatus === "paid" ? `✅ Facture ${inv.number} soldée` : `🧾 Paiement reçu — ${inv.number}`,
            newStatus === "paid"
              ? `Merci ! Ta facture ${inv.number} (${inv.total_fcfa} FCFA) est entièrement réglée (${methodLabel}).`
              : `Paiement de ${amount} FCFA reçu (${methodLabel}). Reste à payer : ${patientShare - newPaid} FCFA.`,
          ],
        );
      }
    } catch (e) {
      console.error("invoice notif:", e);
    }

    await audit(session, {
      action: "modifier",
      entity: "facture",
      entityId: inv.id,
      patientId: inv.patient_id,
      detail: `Encaissement ${amount} FCFA (${methodLabel}) sur ${inv.number} → ${newPaid}/${inv.total_fcfa} FCFA`,
    });

    return NextResponse.json({ ok: true, paid: newPaid, status: newStatus });
  } catch (e) {
    console.error("invoice PUT:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
