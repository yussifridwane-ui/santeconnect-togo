import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, PRESCRIBER_ROLES, hasRole } from "@/lib/audit";

/**
 * POST /api/patients/[id]/consultations — une consultation = TOUTE la sémiologie :
 * motif → symptômes → constantes (T°, TA, pouls, poids, taille, SpO₂) →
 * observations → diagnostic → traitement → examens demandés → recommandations → prochain RDV.
 * Réservé au médecin / administrateur (signature clinique — traçée dans le journal).
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
      return NextResponse.json({ error: "Seul le médecin peut rédiger une consultation" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const facilityId = session.facilityId || 1;
    const body = await request.json();

    if (!String(body.motif || "").trim()) {
      return NextResponse.json({ error: "Le motif de consultation est obligatoire" }, { status: 400 });
    }

    const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
    if (check.rows.length === 0 || check.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    const num = (v: unknown): number | null => {
      const n = parseFloat(String(v ?? ""));
      return Number.isFinite(n) ? n : null;
    };

    const r = await pool.query(
      `INSERT INTO consultations (patient_id, doctor_id, facility_id, appointment_id,
         motif, symptoms, temperature, blood_pressure, pulse, weight, height, saturation,
         observations, diagnosis, treatment, prescription, exams_requested, recommendations, next_appointment_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        pid,
        session.id,
        facilityId,
        num(body.appointmentId) ?? null,
        String(body.motif || "").slice(0, 255),
        body.symptoms || null,
        num(body.temperature),
        body.bloodPressure ? String(body.bloodPressure).slice(0, 20) : null,
        num(body.pulse) !== null ? Math.round(num(body.pulse) as number) : null,
        num(body.weight),
        num(body.height),
        num(body.saturation),
        body.observations || null,
        body.diagnosis || null,
        body.treatment || null,
        body.prescription || null,
        body.examsRequested || null,
        body.recommendations || null,
        body.nextAppointmentAt || null,
      ],
    );

    await audit(session, {
      action: "creer",
      entity: "consultation",
      entityId: r.rows[0].id,
      patientId: pid,
      detail: `Consultation rédigée par ${session.fullName} — motif : ${String(body.motif).slice(0, 80)} — patient #${pid}`,
    });

    return NextResponse.json({ success: true, consultationId: r.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Create consultation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
