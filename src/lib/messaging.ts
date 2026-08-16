/**
 * 📱💬 MESSAGERIE MULTI-CANAL (V2.6) — SMS + WhatsApp, 100 % sans intervention humaine.
 *
 * SMS : API Brevo (la MÊME clé BREVO_API_KEY que les e-mails — rien d'autre à créer,
 *       juste des crédits SMS dans le compte Brevo).
 * WhatsApp : API Twilio (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WA_FROM).
 *       En période d'essai, Twilio propose un « sandbox » WhatsApp : le patient envoie
 *       une fois un mot-clé au numéro sandbox, puis reçoit tous les rappels.
 *
 * Règle d'or : si un canal n'est pas configuré, il est SILENCIEUSEMENT ignoré —
 * jamais de crash, jamais de blocage du parcours soignant.
 */

/** Normalise un numéro togolais vers le format international (+228XXXXXXXX). */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("+")) return p.length >= 10 ? p : null;
  if (p.length === 8) return "+228" + p;          // numéro local togolais
  if (p.length === 11 && p.startsWith("228")) return "+" + p;
  return p.length >= 10 ? "+" + p : null;
}

/** 📩 SMS transactionnel via Brevo (même clé que l'e-mail). */
export async function sendSms(to: string, text: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  const recipient = toE164(to);
  if (!key || !recipient) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        type: "transactional",
        sender: (process.env.BREVO_SMS_SENDER || "SanteOnline").slice(0, 11),
        recipient: recipient.replace("+", ""),
        content: text,
      }),
    });
    if (!res.ok) {
      console.error("[sms] Brevo a refusé :", res.status, (await res.text()).slice(0, 200));
    }
    return res.ok;
  } catch (e) {
    console.error("[sms] envoi échoué :", e);
    return false;
  }
}

/** 💬 Message WhatsApp via Twilio (sandbox essai ou numéro approuvé). */
export async function sendWhatsapp(to: string, text: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WA_FROM; // ex : whatsapp:+14155238886
  const recipient = toE164(to);
  if (!sid || !token || !from || !recipient) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
          To: `whatsapp:${recipient}`,
          Body: text,
        }).toString(),
      },
    );
    if (!res.ok) {
      console.error("[whatsapp] Twilio a refusé :", res.status, (await res.text()).slice(0, 200));
    }
    return res.ok;
  } catch (e) {
    console.error("[whatsapp] envoi échoué :", e);
    return false;
  }
}
