import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, MEDICAL_ROLES, hasRole } from "@/lib/audit";

/**
 * GET /api/patients/[id]/dme — DOSSIER MÉDICAL ÉLECTRONIQUE complet.
 * Tout le parcours clinique en une lecture : identité, antécédents,
 * constantes, consultations (sémiologie complète), ordonnances + items,
 * examens demandés & résultats — avec les coordonnées professionnelles
 * de l'établissement et du médecin. Réservé au personnel médical (admin/médecin/infirmier).
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
    if (!hasRole(session, MEDICAL_ROLES)) {
      return NextResponse.json({ error: "Dossier médical réservé au personnel médical" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const facilityId = session.facilityId || 1;

    const prow = await pool.query(
      `SELECT p.*, u.full_name, u.email, u.phone, f.name AS facility_name, f.type AS facility_type,
              f.address AS facility_address, f.city AS facility_city
       FROM patients p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN facilities f ON f.id = p.facility_id
       WHERE p.id = $1 AND p.facility_id = $2`,
      [pid, facilityId],
    );
    if (prow.rows.length === 0) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
    const p = prow.rows[0];

    const [cons, ords, lab, img, cond, meds, alg, soc, fam, contra, mets, jour] = await Promise.all([
      pool.query(
        `SELECT c.*, d.full_name AS doctor_name
         FROM consultations c LEFT JOIN users d ON d.id = c.doctor_id
         WHERE c.patient_id = $1 ORDER BY c.created_at DESC LIMIT 100`,
        [pid],
      ),
      pool.query(
        `SELECT o.id, o.consultation_id, o.instructions, o.created_at, d.full_name AS doctor_name
         FROM prescriptions o LEFT JOIN users d ON d.id = o.doctor_id
         WHERE o.patient_id = $1 ORDER BY o.created_at DESC LIMIT 100`,
        [pid],
      ),
      pool.query(
        `SELECT 'labo' AS kind, id, exam_type, status, result, comment, created_at, validated_at
         FROM lab_requests WHERE patient_id = $1`,
        [pid],
      ),
      pool.query(
        `SELECT 'imagerie' AS kind, id, exam_type, status, report AS result, request_note AS comment, created_at, NULL::timestamp AS validated_at
         FROM imaging_exams WHERE patient_id = $1`,
        [pid],
      ),
      pool.query(`SELECT id, name, icd_code, diagnosed_year, status, notes FROM patient_conditions WHERE patient_id = $1 ORDER BY diagnosed_year DESC NULLS LAST`, [pid]),
      pool.query(`SELECT id, name, dosage, posology, frequency, since, active, notes FROM patient_medications WHERE patient_id = $1 ORDER BY active DESC, created_at DESC`, [pid]),
      pool.query(`SELECT id, substance, reaction, severity FROM patient_allergies WHERE patient_id = $1 ORDER BY severity DESC NULLS LAST`, [pid]),
      pool.query(`SELECT tobacco, alcohol, activity, notes FROM patient_social_history WHERE patient_id = $1`, [pid]),
      pool.query(`SELECT id, relative, condition, notes FROM patient_family_history WHERE patient_id = $1 ORDER BY id`, [pid]),
      pool.query(`SELECT id, item, notes FROM patient_contraindications WHERE patient_id = $1 ORDER BY id`, [pid]),
      pool.query(`SELECT id, metric, value, value2, unit, taken_at, source FROM patient_metrics WHERE patient_id = $1 ORDER BY taken_at DESC LIMIT 100`, [pid]),
      pool.query(`SELECT id, entry_date, mood, symptoms, note FROM patient_journal WHERE patient_id = $1 ORDER BY entry_date DESC LIMIT 30`, [pid]),
    ]);

    let items: Record<string, unknown>[] = [];
    if (ords.rows.length > 0) {
      const ids = ords.rows.map((o) => o.id);
      const it = await pool.query(
        `SELECT prescription_id, medication, dosage, posology, frequency, duration, instructions
         FROM prescription_items WHERE prescription_id = ANY($1::int[]) ORDER BY id`,
        [ids],
      );
      items = it.rows;
    }

    const exams = [...lab.rows, ...img.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    await audit(session, {
      action: "consulter",
      entity: "dossier",
      entityId: pid,
      patientId: pid,
      detail: `${session.fullName} a consulté le DME complet du patient ${p.full_name || "#" + pid}`,
    });

    return NextResponse.json({
      patient: {
        id: p.id,
        recordNumber: p.record_number,
        fullName: p.full_name,
        dateOfBirth: p.date_of_birth,
        gender: p.gender,
        bloodType: p.blood_type,
        phone: p.phone,
        email: p.email,
        medicalNotes: p.medical_notes,
        insurerName: p.insurer_name,
        coverageStatus: p.coverage_status,
      },
      // 🏥 Coordonnées professionnelles (en-tête officielle des documents)
      professional: {
        facilityName: p.facility_name,
        facilityType: p.facility_type,
        facilityAddress: p.facility_address,
        facilityCity: p.facility_city,
        lastDoctor: cons.rows[0]?.doctor_name || null,
      },
      consultations: cons.rows.map((c) => ({
        id: c.id,
        motif: c.motif,
        symptoms: c.symptoms,
        temperature: c.temperature,
        bloodPressure: c.blood_pressure,
        pulse: c.pulse,
        weight: c.weight,
        height: c.height,
        saturation: c.saturation,
        observations: c.observations,
        diagnosis: c.diagnosis,
        treatment: c.treatment,
        prescription: c.prescription,
        examsRequested: c.exams_requested,
        recommendations: c.recommendations,
        nextAppointmentAt: c.next_appointment_at,
        createdAt: c.created_at,
        doctorName: c.doctor_name,
      })),
      ordonnances: ords.rows.map((o) => ({
        id: o.id,
        consultationId: o.consultation_id,
        instructions: o.instructions,
        createdAt: o.created_at,
        doctorName: o.doctor_name,
        items: items.filter((i) => i.prescription_id === o.id),
      })),
      exams,
      // 🧬 V2.4 — Profil de santé structuré + suivi + journal
      conditions: cond.rows,
      medications: meds.rows,
      allergies: alg.rows,
      socialHistory: soc.rows[0] || null,
      familyHistory: fam.rows,
      contraindications: contra.rows,
      metrics: mets.rows,
      journal: jour.rows,
    });
  } catch (error) {
    console.error("Get DME error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
