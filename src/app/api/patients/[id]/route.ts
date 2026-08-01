import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { patients } from "@/db/schema";
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
      .update(patients)
      .set({
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        gender: body.gender,
        bloodType: body.bloodType,
        address: body.address,
        emergencyContact: body.emergencyContact,
        emergencyPhone: body.emergencyPhone,
        insuranceNumber: body.insuranceNumber,
        medicalNotes: body.medicalNotes,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update patient error:", error);
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
    await db
      .delete(patients)
      .where(eq(patients.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete patient error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
