import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getShopForUser, ensureShopSub, shopSubState } from "@/lib/sika";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json({ shop: null });
    const sub = await ensureShopSub(shop.id);
    return NextResponse.json({ shop, sub, state: shopSubState(sub) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    const [shop] = await db
      .insert(shops)
      .values({
        ownerId: session.id,
        name: body.name,
        phone: body.phone || null,
        city: body.city || "Lomé",
        address: body.address || "",
      })
      .returning();
    const sub = await ensureShopSub(shop.id);
    return NextResponse.json({ shop, sub, state: shopSubState(sub) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
