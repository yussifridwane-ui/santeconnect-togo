import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, PRESCRIBER_ROLES, hasRole } from "@/lib/audit";

const CONFIG: Record<string, { table: string; note: string }> = {
  condition: { table: "patient_conditions", note: "Condition de santé" },
  medication: { table: "patient_medications", note: "Médicament actuel" },
  allergy: { table: "patient_allergies", note: "Allergie" },
  family: { table: "patient_family_history", note: "Antécédent familial" },
  contraindication: { table: "patient_contraindications", note: "Contre-indication" },
};

/**
 * POST /api/patients/[id]/sante — mutations du PROFIL DE SANTÉ structuré.
 * { kind, op: "add"|"del", id?, ...champs }. Réservé médecin/admin (signature + audit).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!hasRole(session, PRESCRIBER_ROLES)) {
      return NextResponse.json({ error: "Réservé au médecin et à l'administrateur" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const body = await request.json();
    const kind = String(body.kind || "");
    const op = body.op === "del" ? "del" : "add";
    const facilityId = session.facilityId || 1;

    const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
    if (check.rows.length === 0 || check.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    /* Histoire sociale = ligne unique par patient (upsert) */
    if (kind === "social") {
      await pool.query(
        `INSERT INTO patient_social_history (patient_id, tobacco, alcohol, activity, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5, now())
         ON CONFLICT (patient_id) DO UPDATE SET
           tobacco = COALESCE($2, patient_social_history.tobacco),
           alcohol = COALESCE($3, patient_social_history.alcohol),
           activity = COALESCE($4, patient_social_history.activity),
           notes = COALESCE($5, patient_social_history.notes),
           updated_at = now()`,
        [pid, body.tobacco ?? null, body.alcohol ?? null, body.activity ?? null, body.notes ?? null],
      );
      await audit(session, { action: "modifier", entity: "patient", patientId: pid, detail: `Histoire sociale mise à jour par ${session.fullName}` });
      return NextResponse.json({ success: true });
    }

    const cfg = CONFIG[kind];
    if (!cfg) {
      return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
    }

    if (op === "del") {
      const rid = parseInt(String(body.id || ""));
      if (!Number.isFinite(rid)) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      await pool.query(`DELETE FROM ${cfg.table} WHERE id = $1 AND patient_id = $2`, [rid, pid]);
      await audit(session, { action: "modifier", entity: "patient", entityId: rid, patientId: pid, detail: `${cfg.note} #${rid} retirée du dossier par ${session.fullName}` });
      return NextResponse.json({ success: true });
    }

    let insertId = 0;
    if (kind === "condition") {
      if (!String(body.name || "").trim()) return NextResponse.json({ error: "Nom de la condition obligatoire" }, { status: 400 });
      const r = await pool.query(
        `INSERT INTO patient_conditions (patient_id, name, icd_code, diagnosed_year, status, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [pid, String(body.name).slice(0, 255), body.icdCode ? String(body.icdCode).slice(0, 20) : null, parseInt(String(body.diagnosedYear || "")) || null, body.status === "resolved" ? "resolved" : "active", body.notes || null],
      );
      insertId = r.rows[0].id;
    } else if (kind === "medication") {
      if (!String(body.name || "").trim()) return NextResponse.json({ error: "Nom du médicament obligatoire" }, { status: 400 });
      const r = await pool.query(
        `INSERT INTO patient_medications (patient_id, name, dosage, posology, frequency, since, active, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [pid, String(body.name).slice(0, 255), body.dosage || null, body.posology || null, body.frequency || null, body.since || null, body.active !== false, body.notes || null],
      );
      insertId = r.rows[0].id;
    } else if (kind === "allergy") {
      if (!String(body.substance || "").trim()) return NextResponse.json({ error: "Substance obligatoire" }, { status: 400 });
      const r = await pool.query(
        `INSERT INTO patient_allergies (patient_id, substance, reaction, severity) VALUES ($1,$2,$3,$4) RETURNING id`,
        [pid, String(body.substance).slice(0, 160), body.reaction || null, ["legere", "moderee", "severe"].includes(body.severity) ? body.severity : "moderee"],
      );
      insertId = r.rows[0].id;
    } else if (kind === "family") {
      if (!String(body.relative || "").trim() || !String(body.condition || "").trim())
        return NextResponse.json({ error: "Membre et condition obligatoires" }, { status: 400 });
      const r = await pool.query(
        `INSERT INTO patient_family_history (patient_id, relative, condition, notes) VALUES ($1,$2,$3,$4) RETURNING id`,
        [pid, String(body.relative).slice(0, 80), String(body.condition).slice(0, 255), body.notes || null],
      );
      insertId = r.rows[0].id;
    } else if (kind === "contraindication") {
      if (!String(body.item || "").trim()) return NextResponse.json({ error: "Élément obligatoire" }, { status: 400 });
      const r = await pool.query(
        `INSERT INTO patient_contraindications (patient_id, item, notes) VALUES ($1,$2,$3) RETURNING id`,
        [pid, String(body.item).slice(0, 255), body.notes || null],
      );
      insertId = r.rows[0].id;
    }

    await audit(session, { action: "creer", entity: "patient", entityId: insertId, patientId: pid, detail: `${cfg.note} ajoutée au dossier par ${session.fullName} — patient #${pid}` });
    return NextResponse.json({ success: true, id: insertId }, { status: 201 });
  } catch (error) {
    console.error("Sante mutation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
