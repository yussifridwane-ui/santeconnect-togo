import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, PRESCRIBER_ROLES, hasRole } from "@/lib/audit";

/**
 * Les examens vivent DANS LE DOSSIER DU PATIENT (V2.2) — plus de « cours » :
 * un médecin demande un examen, le labo/radiologie renseigne le résultat,
 * le médecin valide. Cycle : Demandé → En cours → Terminé → Validé.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role === "patient") {
      return NextResponse.json({ error: "Utilisez votre espace patient sécurisé (code du dossier)" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const facilityId = session.facilityId || 1;

    // Sécurité d'isolation : la fiche doit appartenir à SON établissement
    const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }
    if (check.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const [lab, img] = await Promise.all([
      pool.query(
        `SELECT l.id, 'labo' AS kind, l.exam_type, l.status, l.result, l.comment, l.created_at, l.validated_at,
                d.full_name AS doctor_name, v.full_name AS validated_by_name
         FROM lab_requests l
         LEFT JOIN users d ON d.id = l.doctor_id
         LEFT JOIN users v ON v.id = l.validated_by
         WHERE l.patient_id = $1 ORDER BY l.created_at DESC`,
        [pid],
      ),
      pool.query(
        `SELECT i.id, 'imagerie' AS kind, i.exam_type, i.status, i.report AS result, i.request_note AS comment,
                i.created_at, NULL::timestamp AS validated_at, d.full_name AS doctor_name, NULL AS validated_by_name
         FROM imaging_exams i
         LEFT JOIN users d ON d.id = i.doctor_id
         WHERE i.patient_id = $1 ORDER BY i.created_at DESC`,
        [pid],
      ),
    ]);

    const exams = [...lab.rows, ...img.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        examType: r.exam_type,
        status: r.status,
        result: r.result,
        comment: r.comment,
        createdAt: r.created_at,
        validatedAt: r.validated_at,
        doctorName: r.doctor_name,
        validatedByName: r.validated_by_name,
      }));

    return NextResponse.json({ exams });
  } catch (error) {
    console.error("Get patient exams error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** POST — le médecin DEMANDE un examen pour ce patient (biologie ou imagerie). */
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
      return NextResponse.json({ error: "Seul un médecin peut demander un examen" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const body = await request.json();
    const kind = body.kind === "imagerie" ? "imagerie" : "labo";
    const examType = String(body.examType || "").trim();
    const note = String(body.note || "").trim();
    if (!examType) {
      return NextResponse.json({ error: "Nom de l'examen obligatoire" }, { status: 400 });
    }

    const facilityId = session.facilityId || 1;
    const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
    if (check.rows.length === 0 || check.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    if (kind === "labo") {
      await pool.query(
        `INSERT INTO lab_requests (patient_id, doctor_id, facility_id, exam_type, status, comment)
         VALUES ($1, $2, $3, $4, 'requested', $5)`,
        [pid, session.id, facilityId, examType.slice(0, 255), note || null],
      );
    } else {
      await pool.query(
        `INSERT INTO imaging_exams (patient_id, doctor_id, facility_id, exam_type, status, request_note)
         VALUES ($1, $2, $3, $4, 'requested', $5)`,
        [pid, session.id, facilityId, examType.slice(0, 60), [examType.length > 60 ? examType : null, note || null].filter(Boolean).join(" — ") || null],
      );
    }

    await audit(session, {
      action: "creer",
      entity: kind === "labo" ? "labo" : "imagerie",
      patientId: pid,
      detail: `Examen demandé (${kind}) : ${examType} — patient #${pid}`,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Create patient exam error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
