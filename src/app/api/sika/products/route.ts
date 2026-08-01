import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sikaProducts } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getShopForUser, ensureShopSub, shopSubState, SIKA_PLANS } from "@/lib/sika";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json([]);
    const rows = await db
      .select()
      .from(sikaProducts)
      .where(eq(sikaProducts.shopId, shop.id))
      .orderBy(desc(sikaProducts.createdAt));
    return NextResponse.json(rows);
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
    if (!shop) return NextResponse.json({ error: "Créez d'abord une boutique" }, { status: 400 });
    const sub = await ensureShopSub(shop.id);
    const state = shopSubState(sub);
    if (!state.allowed) return NextResponse.json({ error: state.message }, { status: 403 });
    const plan = SIKA_PLANS[(sub.plan as keyof typeof SIKA_PLANS)] || SIKA_PLANS.pro;
    const [{ c }] = await db.select({ c: count() }).from(sikaProducts).where(eq(sikaProducts.shopId, shop.id));
    if (c >= plan.maxProducts)
      return NextResponse.json({ error: `Limite de ${plan.maxProducts} produits atteinte pour votre formule.` }, { status: 403 });

    const body = await request.json();
    if (!body.name || !body.priceFcfa) return NextResponse.json({ error: "Nom et prix requis" }, { status: 400 });
    const [p] = await db
      .insert(sikaProducts)
      .values({
        shopId: shop.id,
        name: body.name,
        category: body.category || "Général",
        priceFcfa: parseInt(body.priceFcfa),
        costFcfa: parseInt(body.costFcfa) || 0,
        stock: parseInt(body.stock) || 0,
        lowStock: parseInt(body.lowStock) || 5,
      })
      .returning();
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
