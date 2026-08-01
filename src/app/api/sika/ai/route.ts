import { NextResponse } from "next/server";
import { db } from "@/db";
import { sikaSales, sikaSaleItems, sikaProducts } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getShopForUser } from "@/lib/sika";

// Assistant IA SikaStock : analyse les ventes et génère des conseils actionnables.
// Si OPENAI_API_KEY est fournie, le résumé est enrichi par le modèle ; sinon, moteur heuristique.
export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json({ insights: [], summary: "Créez une boutique pour activer l'assistant." });

    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start7 = new Date(now.getTime() - 7 * 86400000);

    const sales7 = await db.select().from(sikaSales).where(and(eq(sikaSales.shopId, shop.id), gte(sikaSales.createdAt, start7)));
    const salesToday = sales7.filter((s) => new Date(s.createdAt) >= startDay);
    const ca7 = sales7.reduce((a, s) => a + s.totalFcfa, 0);
    const caToday = salesToday.reduce((a, s) => a + s.totalFcfa, 0);

    const saleIds = sales7.map((s) => s.id);
    const items = saleIds.length
      ? await db.select().from(sikaSaleItems).where(sql`${sikaSaleItems.saleId} IN (${sql.join(saleIds.map((id) => sql`${id}`), sql`,`)})`)
      : [];

    const byProduct = new Map<string, { name: string; qty: number; ca: number }>();
    items.forEach((i) => {
      const cur = byProduct.get(String(i.productId)) || { name: i.name || "Produit", qty: 0, ca: 0 };
      cur.qty += i.qty;
      cur.ca += i.qty * i.unitPriceFcfa;
      byProduct.set(String(i.productId), cur);
    });
    const top = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 3);

    const products = await db.select().from(sikaProducts).where(eq(sikaProducts.shopId, shop.id));
    const low = products.filter((p) => p.stock <= p.lowStock);

    const projection = Math.round((ca7 / 7) * 30);
    const insights: string[] = [];
    insights.push(`💰 Chiffre d'affaires : ${caToday.toLocaleString("fr-FR")} F aujourd'hui · ${ca7.toLocaleString("fr-FR")} F sur 7 jours.`);
    insights.push(`📈 Projection du mois : environ ${projection.toLocaleString("fr-FR")} F CFA si le rythme actuel se maintient.`);
    if (top.length) insights.push(`🏆 Meilleures ventes : ${top.map((t) => `${t.name} (${t.qty} vendus)`).join(", ")}.`);
    if (low.length) insights.push(`⚠️ Réapprovisionnement urgent : ${low.map((p) => `${p.name} (${p.stock} restants)`).join(", ")}.`);
    else insights.push(`✅ Stocks sains : aucun produit sous le seuil d'alerte.`);
    insights.push(`🧾 ${sales7.length} vente(s) enregistrée(s) cette semaine — ${sales7.filter((s) => s.method === "mixx").length} payée(s) par Mixx by Yas.`);

    let summary = insights.join(" ");
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Tu es l'assistant commercial d'un commerçant togolais. Réponds en français, 3 phrases max, conseils concrets." },
              { role: "user", content: `Données boutique « ${shop.name} » : ${summary}. Donne un conseil prioritaire.` },
            ],
            max_tokens: 150,
          }),
        });
        const d = await r.json();
        if (d.choices?.[0]?.message?.content) summary = d.choices[0].message.content;
      } catch {}
    }

    return NextResponse.json({ insights, summary, ca7, caToday, projection, top, lowStock: low });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
