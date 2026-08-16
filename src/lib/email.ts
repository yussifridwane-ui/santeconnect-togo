/**
 * Envoi d'e-mails transactionnels via Brevo (compte existant de Ridwan).
 * Si BREVO_API_KEY n'est pas configurée sur Netlify, l'e-mail est simplement
 * ignoré (log) — jamais de crash, jamais de blocage du parcours soignant.
 */
export async function sendEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.warn("[email] BREVO_API_KEY absente — e-mail ignoré :", opts.subject);
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": key,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "SantéOnline",
          email: process.env.BREVO_SENDER || "ridwanissifou3@gmail.com",
        },
        to: [{ email: opts.to, name: opts.toName || opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Brevo a refusé :", res.status, (await res.text()).slice(0, 200));
    }
    return res.ok;
  } catch (e) {
    console.error("[email] envoi échoué :", e);
    return false;
  }
}
