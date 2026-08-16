// ⏰ Fonction programmée Netlify — rappels RDV automatiques (aucune intervention humaine).
// Netlify auto-fournit process.env.URL (adresse du site déployé).
exports.handler = async () => {
  const base = process.env.URL || "https://santeonline.netlify.app";
  try {
    const res = await fetch(`${base}/api/system/reminders`, {
      method: "POST",
      headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
    });
    const text = await res.text();
    return { statusCode: 200, body: text };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};
