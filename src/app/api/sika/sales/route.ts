import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sikaSales, sikaSaleItems, sikaProducts, sikaCustomers } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getShopForUser, ensureShopSub, shopSubState } from "@/lib/sika";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json([]);
    const sales = await db.select().from(sikaSales).where(eq(sikaSales.shopId, shop.id)).orderBy(desc(sikaSales.createdAt)).limit(100);
    if (sales.length === 0) return NextResponse.json([]);
    const items = await db
      .select()
      .from(sikaSaleItems)
      .where(inArray(sikaSaleItems.saleId, sales.map((s) => s.id)));
    const bySale = new Map<number, typeof items>();
    items.forEach((i) => {
      const arr = bySale.get(i.saleId) || [];
      arr.push(i);
      bySale.set(i.saleId, arr);
    });
    return NextResponse.json(sales.map((s) => ({ ...s, items: bySale.get(s.id) || [] })));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json({ error: "Boutique requise" }, { status: 400 });
    const sub = await ensureShopSub(shop.id);
    const state = shopSubState(sub);
    if (!state.allowed) return NextResponse.json({ error: state.message }, { status: 403 });

    const body = await request.json();
    const lines: { productId: number; qty: number }[] = body.items || [];
    if (lines.length === 0) return NextResponse.json({ error: "Panier vide" }, { status: 400 });

    const productIds = lines.map((l) => l.productId);
    const products = await db.select().from(sikaProducts).where(inArray(sikaProducts.id, productIds));
    const pMap = new Map(products.map((p) => [p.id, p]));

    let total = 0;
    const prepared: { productId: number; name: string; qty: number; unit: number }[] = [];
    for (const l of lines) {
      const p = pMap.get(l.productId);
      if (!p) return NextResponse.json({ error: "Produit introuvable" }, { status: 400 });
      if (p.stock < l.qty)
        return NextResponse.json({ error: `Stock insuffisant pour « ${p.name} » (reste ${p.stock}).` }, { status: 400 });
      total += p.priceFcfa * l.qty;
      prepared.push({ productId: p.id, name: p.name, qty: l.qty, unit: p.priceFcfa });
    }

    let waLink: string | null = null;
    if (body.customerId) {
      const [cust] = await db.select().from(sikaCustomers).where(eq(sikaCustomers.id, body.customerId)).limit(1);
      if (cust?.phone) {
        const clean = cust.phone.replace(/[^\d]/g, "").replace(/^228/, "");
        const linesTxt = prepared.map((p) => `• ${p.name} x${p.qty} = ${(p.unit * p.qty).toLocaleString("fr-FR")} F`).join("\n");
        const msg = `🧾 *Reçu — ${shop.name}*\n\n${linesTxt}\n\n💰 Total : *${total.toLocaleString("fr-FR")} F CFA*\nMerci pour votre achat ! 🙏`;
        waLink = `https://wa.me/228${clean}?text=${encodeURIComponent(msg)}`;
      }
    }

    const [sale] = await db
      .insert(sikaSales)
      .values({ shopId: shop.id, customerId: body.customerId || null, totalFcfa: total, method: body.method || "cash", waLink })
      .returning();
    await db.insert(sikaSaleItems).values(prepared.map((p) => ({ saleId: sale.id, productId: p.productId, name: p.name, qty: p.qty, unitPriceFcfa: p.unit })));
    for (const p of prepared) {
      const cur = pMap.get(p.productId)!;
      await db.update(sikaProducts).set({ stock: cur.stock - p.qty }).where(eq(sikaProducts.id, p.productId));
    }
    return NextResponse.json({ ...sale, items: prepared, waLink }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
