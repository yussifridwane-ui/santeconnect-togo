import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, STAFF_ROLES, hasRole } from "@/lib/audit";

/* ════════════════════════════════════════════════════════════════════
   🛡️ V2.9 — ASSURANCES MULTIPLES PAR PATIENT (cahier des charges Ridwan)
   GET  /api/patients/[id]/insurances → liste (primaire d'abord)
   POST /api/patients/[id]/insurances → ajouter une couverture
   Réservé au personnel de l'établissement du patient.
   ════════════════════════════════════════════════════════════════════ */

const STATUS_OK = new Set(["actif", "expire", "suspendu", "inconnu"]);

type SessionLite = { id: number; facilityId: number | null };

/* Vérifie : connecté + rôle personnel + patient bien dans SON établissement */
async function checkPatientAccess(
  session: SessionLite,
  pid: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isNaN(pid)) return { ok: false, status: 400, error: "Identifiant invalide" };
  const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
  if (check.rows.length === 0) return { ok: false, status: 404, error: "Patient introuvable" };
  const facilityId = session.facilityId || 1;
  if (check.rows[0].facility_id !== facilityId) {
    return { ok: false, status: 403, error: "Ce patient appartient à un autre établissement" };
  }
  return { ok: true, status: 200 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!hasRole(session, STAFF_ROLES)) {
      return NextResponse.json({ error: "Accès réservé au personnel de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const access = await checkPatientAccess(session, pid);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const r = await pool.query(
      `SELECT pi.id, pi.insurer_id, pi.insurer_name_other, pi.insurance_number,
              pi.status, pi.is_primary, pi.card_document_id, pi.card_serial,
              pi.verified_at, pi.notes, pi.created_at, pi.updated_at,
              i.name AS insurer_name, i.rate AS insurer_rate, i.phone AS insurer_phone
       FROM patient_insurances pi
       LEFT JOIN insurers i ON i.id = pi.insurer_id
       WHERE pi.patient_id = $1
       ORDER BY pi.is_primary DESC, pi.created_at ASC`,
      [pid],
    );
    return NextResponse.json(r.rows);
  } catch (error) {
    console.error("List patient insurances error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!hasRole(session, STAFF_ROLES)) {
      return NextResponse.json({ error: "Accès réservé au personnel de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const access = await checkPatientAccess(session, pid);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await request.json();
    const insurerId = body.insurerId ? parseInt(String(body.insurerId)) : null;
    const insurerNameOther = String(body.insurerNameOther || "").trim().slice(0, 120) || null;
    const insuranceNumber = String(body.insuranceNumber || "").trim().slice(0, 60);
    const status = STATUS_OK.has(String(body.status)) ? String(body.status) : "inconnu";
    const notes = String(body.notes || "").trim().slice(0, 1000) || null;
    const requestedPrimary = body.isPrimary === true;
    const cardDocumentId = body.cardDocumentId ? parseInt(String(body.cardDocumentId)) : null;

    /* Cahier des charges : assureur ET numéro obligatoires, le reste optionnel */
    if (!insuranceNumber) {
      return NextResponse.json({ error: "Le numéro d'assuré est obligatoire" }, { status: 400 });
    }
    if (!insurerId && !insurerNameOther) {
      return NextResponse.json({ error: "Choisis l'assureur (ou saisis le nom de la mutuelle)" }, { status: 400 });
    }

    /* L'assureur choisi doit exister dans la liste V2.7 */
    if (insurerId) {
      const ins = await pool.query(`SELECT id FROM insurers WHERE id = $1`, [insurerId]);
      if (ins.rows.length === 0) {
        return NextResponse.json({ error: "Assureur inconnu" }, { status: 400 });
      }
    }

    /* La carte photo (si fournie) doit appartenir à CE patient — jamais à un autre
       (anti-IDOR : on vérifie toujours la propriété des objets liés) */
    if (cardDocumentId) {
      const doc = await pool.query(
        `SELECT id FROM documents WHERE id = $1 AND patient_id = $2`,
        [cardDocumentId, pid],
      );
      if (doc.rows.length === 0) {
        return NextResponse.json({ error: "Photo de carte introuvable pour ce patient" }, { status: 400 });
      }
    }

    /* Règle métier : si le patient n'a AUCUNE assurance, la première devient
       primaire automatiquement (une et une seule primaire — l'index unique
       partiel en base en fait la police finale). */
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM patient_insurances WHERE patient_id = $1`,
      [pid],
    );
    const mustBePrimary = requestedPrimary || count.rows[0].n === 0;

    /* On retire d'abord l'ancienne primaire, PUIS on pose la nouvelle :
       jamais deux primaires en même temps (même pendant une milliseconde). */
    if (mustBePrimary) {
      await pool.query(
        `UPDATE patient_insurances SET is_primary = false, updated_at = now()
         WHERE patient_id = $1 AND is_primary = true`,
        [pid],
      );
    }

    const r = await pool.query(
      `INSERT INTO patient_insurances
         (patient_id, insurer_id, insurer_name_other, insurance_number, status,
          is_primary, card_document_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [pid, insurerId, insurerId ? null : insurerNameOther, insuranceNumber, status,
       mustBePrimary, cardDocumentId, notes],
    );

    const label = insurerId
      ? (await pool.query(`SELECT name FROM insurers WHERE id = $1`, [insurerId])).rows[0]?.name || "Assureur"
      : insurerNameOther;
    await audit(session, {
      action: "creer",
      entity: "assurance",
      entityId: r.rows[0].id,
      patientId: pid,
      detail: `Assurance « ${label} » (N° •••${insuranceNumber.slice(-4)}) ajoutée${mustBePrimary ? " — définie primaire" : ""}`,
    });

    return NextResponse.json({ success: true, id: r.rows[0].id, isPrimary: mustBePrimary }, { status: 201 });
  } catch (error) {
    console.error("Create patient insurance error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
