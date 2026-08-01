import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sikaCustomers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getShopForUser } from "@/lib/sika";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    if (!shop) return NextResponse.json([]);
    const rows = await db.select().from(sikaCustomers).where(eq(sikaCustomers.shopId, shop.id)).orderBy(desc(sikaCustomers.createdAt));
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
    if (!shop) return NextResponse.json({ error: "Boutique requise" }, { status: 400 });
    const body = await request.json();
    const [c] = await db
      .insert(sikaCustomers)
      .values({ shopId: shop.id, name: body.name, phone: body.phone })
      .returning();
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
