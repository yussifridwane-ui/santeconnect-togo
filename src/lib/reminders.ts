import { pool } from "@/db";
import { SignJWT } from "jose";
import { sendEmail } from "@/lib/email";
import { sendSms, sendWhatsapp, toE164 } from "@/lib/messaging";

/**
 * 🤖 RAPPELS DE RENDEZ-VOUS 100 % AUTOMATIQUES — zéro manipulation humaine.
 * Balayage déclenché 1) par la tâche Netlify programmée (toutes les heures)
 * et 2) au passage sur chaque appel RDV (garde-fou intégré : max 1 balayage / 5 min).
 * Chaque rappel : E-MAIL (Brevo) + SMS (Brevo, même clé) + WHATSAPP (Twilio si configuré)
 * + notification interne, avec un LIEN SIGNÉ permettant au patient de répondre
 * au sondage de présence en 1 clic (✅ présent / ❌ empêché), sans se connecter.
 * Dès sa réponse, le médecin reçoit AUTOMATIQUEMENT une notification (+ e-mail).
 */
/* 🔐 V2.8 — durcissement : en production, JWT_SECRET est OBLIGATOIRE
   (plus de secret de secours falsifiable en ligne). */
function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (s) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production" || process.env.NETLIFY) {
    throw new Error("JWT_SECRET manquant dans l'environnement de production");
  }
  return new TextEncoder().encode("dev-only-secret-do-not-use-in-production");
}

let lastRunAt = 0;

export async function runDueReminders(origin: string): Promise<{ scanned: number; emailed: number; sms?: number; whatsapp?: number; skipped?: boolean }> {
  if (Date.now() - lastRunAt < 5 * 60 * 1000) return { scanned: 0, emailed: 0, skipped: true };
  lastRunAt = Date.now();

  const due = await pool.query(
    `SELECT a.id, a.patient_id, a.title, a.scheduled_date, a.doctor_id, a.facility_id,
            u.email, u.phone AS user_phone, u.full_name, p.whatsapp,
            d.full_name AS doctor_name, f.name AS facility_name
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
  let sms = 0;
  let whatsapp = 0;
  for (const row of due.rows) {
    const when = new Date(row.scheduled_date);
    const dateFr = when.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const heure = when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    /* Lien signé 1 clic (valable jusqu'au RDV + 12 h) — 2 variantes pour le sondage direct */
    const token = await new SignJWT({ scope: "rdv", aid: row.id, pid: row.patient_id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(when.getTime() / 1000 + 3600 * 12)
      .sign(jwtSecret());
    const link = `${origin}/confirmer-rendez-vous?t=${encodeURIComponent(token)}`;
    const linkOui = `${link}&r=oui`;
    const linkNon = `${link}&r=non`;
    const phone = toE164(row.whatsapp || row.user_phone);

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
              <p style="margin:18px 0">Merci de répondre au sondage de présence en 1 clic :</p>
              <p>
                <a href="${linkOui}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px;margin-right:8px">✅ JE SERAI PRÉSENT(E)</a>
                <a href="${linkNon}" style="display:inline-block;background:#fff;color:#b45309;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px;border:2px solid #f59e0b">❌ J'AI UN EMPÊCHEMENT</a>
              </p>
              <p style="color:#6b7280;font-size:12px;margin-top:16px">Votre médecin est automatiquement informé de votre réponse. Si vous avez un empêchement, contactez votre centre de santé au plus tôt pour choisir une nouvelle date.</p>
            </div>
          </div>`,
      });
      if (ok) emailed++;
    }

    /* 📩 SMS (Brevo — même clé que l'e-mail) : court, 1 lien vers le sondage */
    if (phone) {
      const smsText =
        `SantéOnline : rappel RDV demain ${dateFr} a ${heure} (${row.title || "Consultation"}${row.doctor_name ? ", Dr " + row.doctor_name : ""}). ` +
        `Serez-vous present(e) ? Repondez en 1 clic : ${link}`;
      if (await sendSms(phone, smsText)) sms++;
    }

    /* 💬 WhatsApp (Twilio si configuré) : sondage direct avec les 2 boutons */
    if (phone) {
      const waText =
        `🩺 *SantéOnline — Rappel de rendez-vous*\n` +
        `Bonjour ${row.full_name || ""}, rappel de votre rendez-vous *demain* :\n\n` +
        `📋 ${row.title || "Consultation"}\n` +
        `📅 ${dateFr} à ${heure}\n` +
        (row.doctor_name ? `🩺 Dr ${row.doctor_name}\n` : "") +
        (row.facility_name ? `🏥 ${row.facility_name}\n` : "") +
        `\n*Répondez au sondage en 1 clic :*\n` +
        `✅ Je serai présent(e) : ${linkOui}\n` +
        `❌ J'ai un empêchement : ${linkNon}\n\n` +
        `Votre médecin sera automatiquement informé de votre réponse.`;
      if (await sendWhatsapp(phone, waText)) whatsapp++;
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
    console.log(`[rappels] ${due.rows.length} rappel(s) traité(s) — e-mails: ${emailed}, SMS: ${sms}, WhatsApp: ${whatsapp}`);
  }

  /* 🧾 RAPPELS FACTURES IMPAYÉES (V2.5) — automatique, sans intervention humaine :
     une facture non soldée depuis plus de 3 jours → notification unique à la caisse. */
  try {
    const unpaid = await pool.query(
      `SELECT i.id, i.number, i.total_fcfa, i.facility_id,
              pu.full_name AS patient_name
       FROM invoices i
       LEFT JOIN patients p ON p.id = i.patient_id
       LEFT JOIN users pu ON pu.id = p.user_id
       WHERE i.status <> 'paid' AND i.reminded_at IS NULL
         AND i.created_at < now() - interval '3 days'
       LIMIT 50`,
    );
    for (const f of unpaid.rows) {
      const caisse = await pool.query(
        `SELECT id FROM users WHERE facility_id = $1 AND role IN ('admin','secretary') AND is_active = true`,
        [f.facility_id],
      );
      for (const c of caisse.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, facility_id, type, title, body, link)
           VALUES ($1,$2,'paiement',$3,$4,'/dashboard/facturation')`,
          [
            c.id, f.facility_id,
            `🧾 Facture ${f.number} en attente depuis 3 jours`,
            `${f.patient_name || "Un patient"} doit encore ${Number(f.total_fcfa).toLocaleString("fr-FR")} FCFA. Pense à relancer.`,
          ],
        );
      }
      await pool.query(`UPDATE invoices SET reminded_at = now() WHERE id = $1`, [f.id]);
    }
    if (unpaid.rows.length > 0) {
      console.log(`[rappels] ${unpaid.rows.length} rappel(s) de facture impayée envoyé(s)`);
    }
  } catch (e) {
    console.error("[rappels] factures impayées:", e);
  }

  return { scanned: due.rows.length, emailed, sms, whatsapp };
}
