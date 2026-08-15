import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

const UPDATE_ROLES = ["admin", "doctor", "nurse", "lab"];
const VALIDATE_ROLES = ["admin", "doctor"];
const STATUSES = ["requested", "in_progress", "completed", "validated"];

/**
 * PUT — mise à jour du cycle de vie d'un examen du dossier patient.
 * Corps : { kind: "labo"|"imagerie", status?, result?, comment? }
 * « Validé » est réservé au médecin (signature médicale du résultat).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!UPDATE_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Réservé au personnel médical et au laboratoire" }, { status: 403 });
    }

    await ensureMigrated();
    const { id, examId } = await params;
    const pid = parseInt(id);
    const eid = parseInt(examId);
    const body = await request.json();
    const kind = body.kind === "imagerie" ? "imagerie" : "labo";
    const status = STATUSES.includes(body.status) ? body.status : null;
    const result = typeof body.result === "string" ? body.result : null;
    const comment = typeof body.comment === "string" ? body.comment : null;

    if (status === "validated" && !VALIDATE_ROLES.includes(session.role)) {
      await audit(session, {
        action: "refus",
        entity: kind === "labo" ? "labo" : "imagerie",
        entityId: eid,
        patientId: pid,
        detail: `Tentative de validation d'examen par un non-médecin (${session.role})`,
      });
      return NextResponse.json({ error: "Seul le médecin peut valider un résultat" }, { status: 403 });
    }
    if (!status && result === null && comment === null) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    const table = kind === "labo" ? "lab_requests" : "imaging_exams";
    const found = await pool.query(
      `SELECT id FROM ${table} WHERE id = $1 AND patient_id = $2`,
      [eid, pid],
    );
    if (found.rows.length === 0) {
      return NextResponse.json({ error: "Examen introuvable pour ce patient" }, { status: 404 });
    }

    if (kind === "labo") {
      await pool.query(
        `UPDATE lab_requests SET
           status = COALESCE($3, status),
           result = COALESCE($4, result),
           comment = COALESCE($5, comment),
           validated_by = CASE WHEN $3 = 'validated' THEN $6 ELSE validated_by END,
           validated_at = CASE WHEN $3 = 'validated' THEN now() ELSE validated_at END,
           updated_at = now()
         WHERE id = $1 AND patient_id = $2`,
        [eid, pid, status, result, comment, session.id],
      );
    } else {
      await pool.query(
        `UPDATE imaging_exams SET
           status = COALESCE($3, status),
           report = COALESCE($4, report),
           request_note = COALESCE($5, request_note),
           updated_at = now()
         WHERE id = $1 AND patient_id = $2`,
        [eid, pid, status === "validated" ? "validated" : status, result, comment],
      );
    }

    await audit(session, {
      action: status === "validated" ? "valider" : "modifier",
      entity: kind === "labo" ? "labo" : "imagerie",
      entityId: eid,
      patientId: pid,
      detail:
        status === "validated"
          ? `${session.fullName} a VALIDÉ le résultat de l'examen #${eid} (${kind}) du patient #${pid}`
          : `Examen #${eid} (${kind}) du patient #${pid} : ${status ? "statut → " + status : "résultat mis à jour"}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update patient exam error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
