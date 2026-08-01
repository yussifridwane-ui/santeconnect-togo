import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
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

    const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : undefined;
    const endDate = scheduledDate
      ? new Date(scheduledDate.getTime() + (body.duration || 30) * 60000)
      : undefined;

    const updated = await db
      .update(appointments)
      .set({
        title: body.title,
        type: body.type,
        status: body.status,
        scheduledDate,
        endDate,
        notes: body.notes,
        patientId: body.patientId ? parseInt(body.patientId) : undefined,
        facilityId: body.facilityId ? parseInt(body.facilityId) : undefined,
        doctorId:
          body.doctorId !== undefined
            ? body.doctorId
              ? parseInt(body.doctorId)
              : null
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Update appointment error:", error);
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
      .delete(appointments)
      .where(eq(appointments.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete appointment error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
