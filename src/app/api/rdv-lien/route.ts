import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { pool } from "@/db";
import { ensureMigrated } from "@/db/migrate";

const KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "togo-health-messaging-secret-key-2024"
);

import { sendEmail } from "@/lib/email";

/**
 * POST /api/rdv-lien — le patient clique DEPUIS SON E-MAIL / SMS / WHATSAPP,
 * sans se connecter. Le jeton signé prouve son identité (réservé à CE rendez-vous).
 * Corps : { t: string, response?: "confirmed" | "declined" }
 * Le paramètre r=oui / r=non (sondage dans le message) pré-remplit la réponse.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    const body = await request.json();
    const r = String(body.r || "");
    const response =
      body.response === "declined" || r === "non" ? "declined"
      : r === "oui" || body.response === "confirmed" || !body.response ? "confirmed"
      : "confirmed";

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
              u.full_name AS patient_name, d.full_name AS doctor_name, d.email AS doctor_email,
              f.name AS facility_name, p.facility_id
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
                ? `✅ ${a.patient_name} a confirmé sa présence (sondage)`
                : `⚠️ ${a.patient_name} a signalé un empêchement (sondage)`,
              `Rendez-vous « ${a.title || "Consultation"} » du ${new Date(a.scheduled_date).toLocaleDateString("fr-FR")}.`,
            ],
          );
          /* 📧 Le médecin reçoit AUSSI un e-mail automatique — aucune manipulation requise */
          if (a.doctor_email) {
            const dateFr = new Date(a.scheduled_date).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
            await sendEmail({
              to: a.doctor_email,
              toName: a.doctor_name || undefined,
              subject: response === "confirmed"
                ? `✅ ${a.patient_name} confirme sa présence`
                : `⚠️ ${a.patient_name} signale un empêchement`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
                  <div style="background:#047857;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0"><b>🩺 SantéOnline — réponse au sondage</b></div>
                  <div style="border:1px solid #d1fae5;border-top:none;padding:18px;border-radius:0 0 12px 12px">
                    <p>Bonjour Dr ${a.doctor_name || ""},</p>
                    <p>Pour le rendez-vous « <b>${a.title || "Consultation"}</b> » du <b>${dateFr}</b> :</p>
                    <p style="font-size:16px;font-weight:bold;color:${response === "confirmed" ? "#059669" : "#b45309"}">
                      ${response === "confirmed" ? `✅ ${a.patient_name} a confirmé sa présence.` : `⚠️ ${a.patient_name} a signalé un empêchement.`}
                    </p>
                  </div>
                </div>`,
            });
          }
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
