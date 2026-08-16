import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * POST /api/patient-portal/rdv-reponse — le patient confirme (ou décline)
 * sa présence DEPUIS SON ESPACE. Le médecin est notifié automatiquement.
 * Corps : { appointmentId: number, response: "confirmed" | "declined" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "patient") {
      return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });
    }

    await ensureMigrated();
    const body = await request.json();
    const aptId = parseInt(String(body.appointmentId || ""));
    const response = body.response === "declined" ? "declined" : "confirmed";

    const me = await pool.query(`SELECT id, facility_id FROM patients WHERE user_id = $1`, [session.id]);
    if (me.rows.length === 0) {
      return NextResponse.json({ error: "Aucun dossier lié à ton compte" }, { status: 404 });
    }

    const apt = await pool.query(
      `SELECT id, doctor_id, title, scheduled_date FROM appointments
       WHERE id = $1 AND patient_id = $2 AND scheduled_date > now()`,
      [aptId, me.rows[0].id],
    );
    if (apt.rows.length === 0) {
      return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
    }

    await pool.query(
      `UPDATE appointments SET patient_response = $2, patient_response_at = now() WHERE id = $1`,
      [aptId, response],
    );

    const a = apt.rows[0];
    const dateFr = new Date(a.scheduled_date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    /* 🔔 Notification automatique au médecin concerné */
    if (a.doctor_id) {
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, facility_id, type, title, body, link)
           VALUES ($1, $2, 'reponse_rdv', $3, $4, '/dashboard/appointments')`,
          [
            a.doctor_id,
            me.rows[0].facility_id,
            response === "confirmed"
              ? `✅ ${session.fullName} a confirmé sa présence`
              : `⚠️ ${session.fullName} a signalé un empêchement`,
            `Rendez-vous « ${a.title || "Consultation"} » du ${dateFr}.`,
          ],
        );
      } catch (e) {
        console.error("[rdv-reponse] notification médecin:", e);
      }
    }

    await audit(session, {
      action: "consulter",
      entity: "rendez_vous",
      entityId: aptId,
      patientId: me.rows[0].id,
      detail: `Le patient a ${response === "confirmed" ? "CONFIRMÉ sa présence" : "DÉCLINÉ"} pour le RDV #${aptId} du ${dateFr}`,
    });

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error("RDV response error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
