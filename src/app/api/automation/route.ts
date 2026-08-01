import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { automationLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getRules, updateRules } from "@/lib/automation";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!session.facilityId) return NextResponse.json({ error: "Aucun cabinet" }, { status: 400 });

    const rules = await getRules(session.facilityId);
    const log = await db
      .select()
      .from(automationLog)
      .where(eq(automationLog.facilityId, session.facilityId))
      .orderBy(desc(automationLog.createdAt))
      .limit(50);

    return NextResponse.json({ rules, log, now: new Date().toISOString() });
  } catch (error) {
    console.error("Automation GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin" || !session.facilityId)
      return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });

    const body = await request.json();
    const rules = await updateRules(session.facilityId, body);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Automation PUT error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
