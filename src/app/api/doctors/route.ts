import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, facilities } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const facilityId = searchParams.get("facilityId");

    const result = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        facilityId: users.facilityId,
        facilityName: facilities.name,
      })
      .from(users)
      .leftJoin(facilities, eq(users.facilityId, facilities.id))
      .where(
        facilityId
          ? and(eq(users.role, "doctor"), eq(users.facilityId, parseInt(facilityId)))
          : eq(users.role, "doctor")
      );

    /* 🔐 V2.8 — Minimisation : un PATIENT ne doit recevoir que le strict
       nécessaire (nom + établissement). Emails/téléphones = réservé au personnel. */
    if (session.role === "patient") {
      return NextResponse.json(
        result.map((d) => ({ id: d.id, fullName: d.fullName, facilityName: d.facilityName })),
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get doctors error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
