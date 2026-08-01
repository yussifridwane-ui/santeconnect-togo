import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!session.facilityId) {
      return NextResponse.json([]);
    }
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.facilityId, session.facilityId))
      .orderBy(desc(payments.createdAt))
      .limit(30);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Payments list error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
