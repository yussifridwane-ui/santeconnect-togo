import { pool } from "@/db";
import { SignJWT } from "jose";
import { sendEmail } from "@/lib/email";

/**
 * 🤖 RAPPELS DE RENDEZ-VOUS 100 % AUTOMATIQUES — zéro manipulation humaine.
 * Balayage déclenché 1) par la tâche Netlify programmée (toutes les heures)
 * et 2) au passage sur chaque appel RDV (garde-fou intégré : max 1 balayage / 5 min).
 * Chaque rappel : e-mail (Brevo) + notification interne, avec un LIEN SIGNÉ
 * permettant au patient de confirmer sa présence en 1 clic, sans se connecter.
 */
const KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "togo-health-messaging-secret-key-2024"
);

let lastRunAt = 0;

export async function runDueReminders(origin: string): Promise<{ scanned: number; emailed: number; skipped?: boolean }> {
  if (Date.now() - lastRunAt < 5 * 60 * 1000) return { scanned: 0, emailed: 0, skipped: true };
  lastRunAt = Date.now();

  const due = await pool.query(
    `SELECT a.id, a.patient_id, a.title, a.scheduled_date, a.doctor_id, a.facility_id,
            u.email, u.full_name, d.full_name AS doctor_name, f.name AS facility_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN users d ON d.id = a.doctor_id
     LEFT JOIN facilities f ON f.id = a.facility_id
     WHERE a.reminder_sent_at IS NULL
       AND a.status IN ('pending', 'confirmed', 'rescheduled')
       AND a.scheduled_date BETWEEN now() + interval '20 hours' AND now() + interval '28 hours'
     ORDER BY a.scheduled_date`
  );

  let emailed = 0;
  for (const row of due.rows) {
    const when = new Date(row.scheduled_date);
    const dateFr = when.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const heure = when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    /* Lien signé 1 clic (valable jusqu'au RDV) */
    const token = await new SignJWT({ scope: "rdv", aid: row.id, pid: row.patient_id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(when.getTime() / 1000 + 3600 * 12)
      .sign(KEY);
    const link = `${origin}/confirmer-rendez-vous?t=${encodeURIComponent(token)}`;

    if (row.email) {
      const ok = await sendEmail({
        to: row.email,
        toName: row.full_name || undefined,
        subject: `⏰ Rappel : votre rendez-vous demain ${heure} — confirmez votre présence`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
            <div style="background:#047857;color:#fff;padding:16px 20px;border-radius:14px 14px 0 0">
              <b style="font-size:18px">🩺 SantéOnline</b>
            </div>
            <div style="border:1px solid #d1fae5;border-top:none;padding:20px;border-radius:0 0 14px 14px">
              <p>Bonjour ${row.full_name || ""},</p>
              <p>Nous vous rappelons votre rendez-vous <b>demain</b> :</p>
              <table style="width:100%;font-size:15px;margin:12px 0">
                <tr><td style="color:#6b7280">Motif</td><td><b>${row.title || "Consultation"}</b></td></tr>
                <tr><td style="color:#6b7280">Date</td><td><b>${dateFr} à ${heure}</b></td></tr>
                ${row.doctor_name ? `<tr><td style="color:#6b7280">Médecin</td><td><b>Dr ${row.doctor_name}</b></td></tr>` : ""}
                ${row.facility_name ? `<tr><td style="color:#6b7280">Lieu</td><td><b>${row.facility_name}</b></td></tr>` : ""}
              </table>
              <p style="margin:18px 0">Merci de confirmer votre présence en 1 clic :</p>
              <a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">✅ JE SERAI PRÉSENT(E)</a>
              <p style="color:#6b7280;font-size:12px;margin-top:16px">Si vous avez un empêchement, contactez votre centre de santé au plus tôt.</p>
            </div>
          </div>`,
      });
      if (ok) emailed++;
    }

    /* Notification interne pour le patient (visible dans son espace) */
    try {
      if (row.email) {
        await pool.query(
          `INSERT INTO notifications (user_id, facility_id, type, title, body, link)
           SELECT u.id, $2, 'rappel', $3, $4, '/dashboard' FROM users u WHERE u.email = $1 LIMIT 1`,
          [
            row.email,
            row.facility_id,
            `⏰ Rappel : rendez-vous demain ${dateFr} à ${heure}`,
            `N'oubliez pas votre rendez-vous « ${row.title || "Consultation"} ». Confirmez votre présence depuis votre espace patient.`,
          ],
        );
      }
    } catch (e) {
      console.error("[rappels] notification:", e);
    }

    await pool.query(`UPDATE appointments SET reminder_sent_at = now() WHERE id = $1`, [row.id]);
  }

  if (due.rows.length > 0) {
    console.log(`[rappels] ${due.rows.length} rappel(s) traité(s), ${emailed} e-mail(s) envoyé(s)`);
  }
  return { scanned: due.rows.length, emailed };
}
