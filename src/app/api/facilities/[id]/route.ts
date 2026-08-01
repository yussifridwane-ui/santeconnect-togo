import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { facilities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    await db
      .update(facilities)
      .set({
        name: body.name,
        type: body.type,
        description: body.description,
        address: body.address,
        city: body.city,
        phone: body.phone,
        email: body.email,
        capacity: body.capacity ? parseInt(body.capacity) : null,
        operatingHours: body.operatingHours,
        updatedAt: new Date(),
      })
      .where(eq(facilities.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update facility error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(facilities).where(eq(facilities.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete facility error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
