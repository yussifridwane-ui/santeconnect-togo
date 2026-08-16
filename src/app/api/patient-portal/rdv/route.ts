import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * 🗓️ RÉSERVATION EN LIGNE PAR LE PATIENT (V2.5 — Gestion de cabinet)
 * GET  → liste des médecins de SON centre (pour choisir dans le formulaire)
 * POST → le patient réserve LUI-MÊME : le RDV part en statut « pending »
 *        (en attente) et le personnel (admin/secrétaire) reçoit une notification
 *        pour le confirmer. Jamais besoin du code dossier : c'est juste une demande.
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "patient") {
      return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });
    }
    await ensureMigrated();

    const pr = await pool.query(
      `SELECT p.id, p.facility_id FROM patients p WHERE p.user_id = $1`,
      [session.id],
    );
    const pat = pr.rows[0];
    if (!pat) {
      return NextResponse.json({ error: "Aucun dossier lié à ce compte." }, { status: 404 });
    }

    const doctors = await pool.query(
      `SELECT u.id, u.full_name, f.name AS facility_name
       FROM users u LEFT JOIN facilities f ON f.id = u.facility_id
       WHERE u.role = 'doctor' AND u.is_active = true AND u.facility_id = $1
       ORDER BY u.full_name`,
      [pat.facility_id || -1],
    );
    return NextResponse.json({
      doctors: doctors.rows,
      facilityId: pat.facility_id,
      patientId: pat.id,
    });
  } catch (e) {
    console.error("portail rdv GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "patient") {
      return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });
    }
    await ensureMigrated();

    const pr = await pool.query(
      `SELECT p.id, p.facility_id, u.full_name FROM patients p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1`,
      [session.id],
    );
    const pat = pr.rows[0];
    if (!pat) {
      return NextResponse.json({ error: "Aucun dossier lié à ce compte." }, { status: 404 });
    }

    const body = await request.json();
    const dateStr = String(body.date || "");
    const timeStr = String(body.time || "");
    const motif = String(body.motif || "Consultation").slice(0, 200);
    const doctorId = body.doctorId ? parseInt(body.doctorId) : null;
    const notes = body.notes ? String(body.notes).slice(0, 500) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
      return NextResponse.json({ error: "Date ou heure invalide." }, { status: 400 });
    }
    const scheduled = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(scheduled.getTime()) || scheduled.getTime() < Date.now() - 60 * 60 * 1000) {
      return NextResponse.json({ error: "Choisis une date dans le futur." }, { status: 400 });
    }
    const end = new Date(scheduled.getTime() + 30 * 60000);

    const ins = await pool.query(
      `INSERT INTO appointments (patient_id, facility_id, doctor_id, title, type, status, scheduled_date, end_date, notes, is_auto_scheduled)
       VALUES ($1,$2,$3,$4,'consultation','pending',$5,$6,$7,false) RETURNING id`,
      [pat.id, pat.facility_id || null, doctorId, motif, scheduled, end, notes],
    );

    /* 🔔 Le personnel (admin + secrétaire) du centre est notifié immédiatement */
    try {
      if (pat.facility_id) {
        const staff = await pool.query(
          `SELECT id FROM users WHERE facility_id = $1 AND role IN ('admin','secretary') AND is_active = true`,
          [pat.facility_id],
        );
        const when = scheduled.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
        for (const s of staff.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, facility_id, type, title, body, link)
             VALUES ($1,$2,'rdv',$3,$4,'/dashboard/appointments')`,
            [
              s.id,
              pat.facility_id,
              `🗓️ Demande de RDV en ligne — ${pat.full_name}`,
              `${pat.full_name} demande un rendez-vous le ${when} (${motif}). À confirmer dans l'agenda.`,
            ],
          );
        }
      }
    } catch (e) {
      console.error("portail rdv notif:", e);
    }

    await audit(session, {
      action: "creer",
      entity: "rendez_vous",
      entityId: ins.rows[0]?.id,
      patientId: pat.id,
      detail: `Réservation en ligne par le patient — ${motif} le ${dateStr} ${timeStr}`,
    });

    return NextResponse.json({ ok: true, id: ins.rows[0]?.id }, { status: 201 });
  } catch (e) {
    console.error("portail rdv POST:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
