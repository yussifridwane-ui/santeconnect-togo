import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sikaProducts } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getShopForUser, ensureShopSub, shopSubState, activateShopSub, SIKA_PLANS } from "@/lib/sika";
import { PAYOUT, mixxUssdSteps } from "@/lib/payment-config";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json({ error: "Boutique requise" }, { status: 400 });
    const sub = await ensureShopSub(shop.id);
    const [{ c }] = await db.select({ c: count() }).from(sikaProducts).where(eq(sikaProducts.shopId, shop.id));
    return NextResponse.json({ sub, state: shopSubState(sub), usage: { products: c }, plans: SIKA_PLANS });
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
    const body = await request.json();
    const plan = body.plan === "business" ? "business" : "pro";
    const price = SIKA_PLANS[plan].priceMonthlyFcfa;

    if (body.action === "declare") {
      await activateShopSub(shop.id, plan);
      return NextResponse.json({ ok: true, message: `Abonnement ${SIKA_PLANS[plan].name} activé. Merci !` });
    }

    // Instructions de paiement Mixx by Yas
    return NextResponse.json({
      instructions: {
        amountFcfa: price,
        plan,
        number: PAYOUT.mixxNumber,
        beneficiary: PAYOUT.beneficiary,
        steps: mixxUssdSteps(PAYOUT.mixxNumber, price),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
