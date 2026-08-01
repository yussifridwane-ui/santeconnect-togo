import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { facilities } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const result = await db.select().from(facilities);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Get facilities error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();

    const newFacility = await db
      .insert(facilities)
      .values({
        name: body.name,
        type: body.type,
        description: body.description,
        address: body.address,
        city: body.city,
        phone: body.phone,
        email: body.email,
        capacity: body.capacity ? parseInt(body.capacity) : null,
        operatingHours: body.operatingHours,
      })
      .returning();

    return NextResponse.json(newFacility[0], { status: 201 });
  } catch (error) {
    console.error("Create facility error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
