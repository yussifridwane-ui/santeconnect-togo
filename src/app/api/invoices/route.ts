import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * 🧾 FACTURATION PATIENTS (V2.5 — Gestion de cabinet)
 * GET  → rapport de facturation avec filtres (Du / Au / statut / recherche)
 *        + totaux (facturé, encaissé, en attente) — comme le « Patient Billing Report ».
 * POST → crée une facture : lignes libres (consultation, acte, médicament…),
 *        numéro automatique FA-ANNEE-XXXX, totaux calculés côté serveur.
 * Rôles : admin + secretary (la caisse). Aucune suppression possible : année
 * scolaire de sécurité — une facture ne se détruit jamais (règle comptable).
 */

const ROLES = ["admin", "secretary"];

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Accès réservé à la caisse (admin/secrétaire)." }, { status: 403 });
    }
    await ensureMigrated();

    const sp = request.nextUrl.searchParams;
    const from = sp.get("from") || "";
    const to = sp.get("to") || "";
    const status = sp.get("status") || "all";
    const q = (sp.get("q") || "").trim();
    const facilityId = session.facilityId || -1;

    const conds: string[] = ["i.facility_id = $1"];
    const params: (string | number)[] = [facilityId];
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { params.push(from); conds.push(`i.created_at::date >= $${params.length}`); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { params.push(to); conds.push(`i.created_at::date <= $${params.length}`); }
    if (["unpaid", "partial", "paid"].includes(status)) { params.push(status); conds.push(`i.status = $${params.length}`); }
    if (q) { params.push(`%${q}%`); conds.push(`(pu.full_name ILIKE $${params.length} OR i.number ILIKE $${params.length})`); }

    const list = await pool.query(
      `SELECT i.id, i.number, i.total_fcfa, i.paid_fcfa, i.status, i.method, i.created_at,
              pu.full_name AS patient_name, p.id AS patient_id,
              (SELECT COUNT(*)::int FROM invoice_items ii WHERE ii.invoice_id = i.id) AS items_count
       FROM invoices i
       LEFT JOIN patients p ON p.id = i.patient_id
       LEFT JOIN users pu ON pu.id = p.user_id
       WHERE ${conds.join(" AND ")}
       ORDER BY i.created_at DESC LIMIT 200`,
      params,
    );

    const stats = await pool.query(
      `SELECT COALESCE(SUM(total_fcfa),0)::bigint AS billed,
              COALESCE(SUM(paid_fcfa),0)::bigint AS collected,
              COALESCE(SUM(GREATEST(total_fcfa - paid_fcfa, 0)),0)::bigint AS outstanding
       FROM invoices i WHERE ${conds.join(" AND ")}`,
      params,
    );

    return NextResponse.json({ items: list.rows, stats: stats.rows[0] });
  } catch (e) {
    console.error("invoices GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Accès réservé à la caisse (admin/secrétaire)." }, { status: 403 });
    }
    await ensureMigrated();

    const body = await request.json();
    const patientId = body.patientId ? parseInt(body.patientId) : null;
    if (!patientId) {
      return NextResponse.json({ error: "Choisis un patient." }, { status: 400 });
    }
    const discount = Math.max(0, parseInt(body.discount) || 0);
    const notes = body.notes ? String(body.notes).slice(0, 500) : null;
    const rawItems: { kind?: string; label?: string; qty?: number; unitPrice?: number }[] =
      Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .map((it) => ({
        kind: ["consultation", "examen", "medicament", "acte", "service"].includes(String(it.kind))
          ? String(it.kind) : "service",
        label: String(it.label || "").slice(0, 250),
        qty: Math.max(1, parseInt(String(it.qty)) || 1),
        unitPrice: Math.max(0, parseInt(String(it.unitPrice)) || 0),
      }))
      .filter((it) => it.label.length > 0);
    if (items.length === 0) {
      return NextResponse.json({ error: "Ajoute au moins une ligne avec un libellé." }, { status: 400 });
    }

    const total = Math.max(0, items.reduce((s, it) => s + it.qty * it.unitPrice, 0) - discount);
    const facilityId = session.facilityId || 1;
    const year = new Date().getFullYear();
    const seq = await pool.query(
      `SELECT COUNT(*)::int AS n FROM invoices WHERE facility_id = $1 AND EXTRACT(year FROM created_at) = $2`,
      [facilityId, year],
    );
    const number = `FA-${year}-${String((seq.rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;

    const ins = await pool.query(
      `INSERT INTO invoices (patient_id, facility_id, number, discount_fcfa, total_fcfa, paid_fcfa, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,0,'unpaid',$6,$7) RETURNING id`,
      [patientId, facilityId, number, discount, total, notes, session.id],
    );
    const invoiceId = ins.rows[0].id as number;

    for (const it of items) {
      await pool.query(
        `INSERT INTO invoice_items (invoice_id, kind, label, qty, unit_price_fcfa, total_fcfa)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [invoiceId, it.kind, it.label, it.qty, it.unitPrice, it.qty * it.unitPrice],
      );
    }

    await audit(session, {
      action: "creer",
      entity: "facture",
      entityId: invoiceId,
      patientId,
      detail: `Facture ${number} créée — ${total} FCFA (${items.length} ligne(s))`,
    });

    return NextResponse.json({ ok: true, id: invoiceId, number }, { status: 201 });
  } catch (e) {
    console.error("invoices POST:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
