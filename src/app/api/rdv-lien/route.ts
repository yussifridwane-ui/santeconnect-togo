import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { pool } from "@/db";
import { ensureMigrated } from "@/db/migrate";

const KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "togo-health-messaging-secret-key-2024"
);

/**
 * POST /api/rdv-lien — le patient clique DEPUIS SON E-MAIL, sans se connecter.
 * Le jeton signé prouve son identité (réservé à CE rendez-vous uniquement).
 * Corps : { t: string, response?: "confirmed" | "declined" }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    const body = await request.json();
    const response = body.response === "declined" ? "declined" : "confirmed";

    let payload: { scope?: unknown; aid?: unknown; pid?: unknown };
    try {
      const v = await jwtVerify(String(body.t || ""), KEY);
      payload = v.payload as typeof payload;
    } catch {
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 401 });
    }
    if (payload.scope !== "rdv" || typeof payload.aid !== "number" || typeof payload.pid !== "number") {
      return NextResponse.json({ error: "Lien invalide" }, { status: 401 });
    }

    const apt = await pool.query(
      `SELECT a.id, a.title, a.scheduled_date, a.doctor_id, a.patient_response,
              u.full_name AS patient_name, d.full_name AS doctor_name, f.name AS facility_name, p.facility_id
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN facilities f ON f.id = a.facility_id
       WHERE a.id = $1 AND a.patient_id = $2`,
      [payload.aid, payload.pid],
    );
    if (apt.rows.length === 0) {
      return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
    }
    const a = apt.rows[0];

    if (!a.patient_response) {
      await pool.query(
        `UPDATE appointments SET patient_response = $2, patient_response_at = now() WHERE id = $1`,
        [payload.aid, response],
      );
      if (a.doctor_id) {
        try {
          await pool.query(
            `INSERT INTO notifications (user_id, facility_id, type, title, body, link)
             VALUES ($1, $2, 'reponse_rdv', $3, $4, '/dashboard/appointments')`,
            [
              a.doctor_id,
              a.facility_id,
              response === "confirmed"
                ? `✅ ${a.patient_name} a confirmé sa présence (e-mail)`
                : `⚠️ ${a.patient_name} a signalé un empêchement (e-mail)`,
              `Rendez-vous « ${a.title || "Consultation"} » du ${new Date(a.scheduled_date).toLocaleDateString("fr-FR")}.`,
            ],
          );
        } catch (e) {
          console.error("[rdv-lien] notification:", e);
        }
      }
      await pool.query(
        `INSERT INTO audit_log (user_name, user_role, facility_id, patient_id, action, entity, entity_id, detail)
         VALUES ($1, 'patient', $2, $3, 'consulter', 'rendez_vous', $4, $5)`,
        [
          a.patient_name || "Patient (lien e-mail)",
          a.facility_id,
          payload.pid,
          payload.aid,
          `Le patient a ${response === "confirmed" ? "CONFIRMÉ sa présence" : "DÉCLINÉ"} via le lien e-mail du RDV #${payload.aid}`,
        ],
      );
    }

    return NextResponse.json({
      success: true,
      already: !!a.patient_response,
      response: a.patient_response || response,
      appointment: {
        title: a.title || "Consultation",
        scheduledDate: a.scheduled_date,
        doctorName: a.doctor_name,
        facilityName: a.facility_name,
        patientName: a.patient_name,
      },
    });
  } catch (error) {
    console.error("RDV lien error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
