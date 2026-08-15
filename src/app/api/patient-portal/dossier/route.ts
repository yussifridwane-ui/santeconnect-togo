import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";
import { verifyDossierToken } from "@/lib/dossier";

/**
 * GET /api/patient-portal/dossier — le dossier DU PATIENT CONNECTÉ, uniquement
 * derrière le jeton de déverrouillage (en-tête x-dossier-token).
 * Ne renvoie que la lecture autorisée au patient : identité de base + examens VALIDÉS.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "patient") {
      return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });
    }

    await ensureMigrated();
    const r = await pool.query(
      `SELECT p.id, p.record_number, p.first_name, p.last_name, p.date_of_birth, p.gender, p.blood_type,
              p.medical_notes, p.insurer_name, p.coverage_status, u.full_name, u.email, u.phone
       FROM patients p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [session.id],
    );
    const p = r.rows[0];
    if (!p) {
      return NextResponse.json(
        { error: "Aucun dossier n'est lié à ton compte — rapproche-toi de ton centre de santé." },
        { status: 404 },
      );
    }

    const ok = await verifyDossierToken(request, p.id, session.id);
    if (!ok) {
      await audit(session, {
        action: "refus",
        entity: "dossier",
        entityId: p.id,
        patientId: p.id,
        detail: `Tentative de lecture du dossier sans code valide`,
      });
      return NextResponse.json({ error: "Code du dossier requis", needCode: true }, { status: 403 });
    }

    /* Uniquement les examens VALIDÉS par le médecin — jamais les résultats en cours */
    const exams = await pool.query(
      `SELECT kind, name, status, result, comment, created_at, validated_at FROM (
         SELECT 'labo' AS kind, exam_type AS name, status, result, comment, created_at, validated_at
         FROM lab_requests WHERE patient_id = $1 AND status = 'validated'
         UNION ALL
         SELECT 'imagerie' AS kind, exam_type AS name, status, report AS result, request_note AS comment, created_at, NULL AS validated_at
         FROM imaging_exams WHERE patient_id = $1 AND status = 'validated'
       ) t ORDER BY t.validated_at DESC NULLS LAST, t.created_at DESC`,
      [p.id],
    );

    return NextResponse.json({
      patient: {
        recordNumber: p.record_number,
        fullName: p.full_name,
        email: p.email,
        phone: p.phone,
        dateOfBirth: p.date_of_birth,
        gender: p.gender,
        bloodType: p.blood_type,
        medicalNotes: p.medical_notes,
        insurerName: p.insurer_name,
        coverageStatus: p.coverage_status,
      },
      exams: exams.rows,
    });
  } catch (error) {
    console.error("Portal dossier error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
