import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
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
      .update(messages)
      .set({
        status: body.status,
      })
      .where(eq(messages.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update message error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
