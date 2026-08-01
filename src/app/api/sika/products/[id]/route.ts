import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sikaProducts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getShopForUser } from "@/lib/sika";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    const { id } = await params;
    const body = await request.json();
    const [p] = await db
      .update(sikaProducts)
      .set({
        name: body.name,
        category: body.category,
        priceFcfa: parseInt(body.priceFcfa),
        costFcfa: parseInt(body.costFcfa) || 0,
        stock: parseInt(body.stock) || 0,
        lowStock: parseInt(body.lowStock) || 5,
      })
      .where(and(eq(sikaProducts.id, parseInt(id)), eq(sikaProducts.shopId, shop!.id)))
      .returning();
    return NextResponse.json(p);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const shop = await getShopForUser(session.id);
    const { id } = await params;
    await db
      .delete(sikaProducts)
      .where(and(eq(sikaProducts.id, parseInt(id)), eq(sikaProducts.shopId, shop!.id)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
