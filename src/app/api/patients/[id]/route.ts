import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/** GET — fiche complète d'un patient (traçée dans le journal de sécurité) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await ensureMigrated();
    const { id } = await params;
    const facilityId = session.facilityId || 1;

    const rows = await db
      .select({ patient: patients, fullName: users.fullName, email: users.email, phone: users.phone })
      .from(patients)
      .leftJoin(users, eq(patients.userId, users.id))
      .where(eq(patients.id, parseInt(id)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    // Un patient ne peut voir que SON propre dossier — vérifié côté serveur
    const row = rows[0];
    if (session.role === "patient" && row.patient.userId !== session.id) {
      await audit(session, { action: "refus", entity: "patient", entityId: row.patient.id, patientId: row.patient.id, detail: "Tentative d'accès au dossier d'un autre patient" });
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (session.role !== "patient" && row.patient.facilityId !== facilityId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await audit(session, {
      action: "consulter",
      entity: "patient",
      entityId: row.patient.id,
      patientId: row.patient.id,
      detail: `${session.fullName} a consulté le dossier de ${row.fullName ?? "patient " + row.patient.id}`,
    });

    return NextResponse.json({ ...row.patient, fullName: row.fullName, email: row.email, phone: row.phone });
  } catch (error) {
    console.error("Get patient error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PUT — modification de la fiche (tous champs étendus, traçée) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role === "patient") {
      return NextResponse.json({ error: "Le dossier ne peut être modifié que par le personnel autorisé" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const body = await request.json();
    const patientId = parseInt(id);

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
        /* Fiche complète SantéOnline v2 */
        firstName: body.firstName,
        lastName: body.lastName,
        usageName: body.usageName,
        placeOfBirth: body.placeOfBirth,
        nationality: body.nationality,
        idType: body.idType,
        idNumber: body.idNumber,
        photoUrl: body.photoUrl,
        phoneSecondary: body.phoneSecondary,
        whatsapp: body.whatsapp,
        country: body.country,
        region: body.region,
        city: body.city,
        commune: body.commune,
        quartier: body.quartier,
        street: body.street,
        houseNumber: body.houseNumber,
        landmark: body.landmark,
        addressFull: body.addressFull,
        maritalStatus: body.maritalStatus,
        spouseName: body.spouseName,
        spousePhone: body.spousePhone,
        childrenCount: body.childrenCount !== undefined ? Number(body.childrenCount) : undefined,
        emergencyName: body.emergencyName,
        emergencyRelation: body.emergencyRelation,
        emergencyPhoneSecondary: body.emergencyPhoneSecondary,
        emergencyWhatsapp: body.emergencyWhatsapp,
        emergencyAddress: body.emergencyAddress,
        emergencyCity: body.emergencyCity,
        profession: body.profession,
        employer: body.employer,
        workPhone: body.workPhone,
        workEmail: body.workEmail,
        workAddress: body.workAddress,
        workCity: body.workCity,
        insurerName: body.insurerName,
        insuredNumber: body.insuredNumber,
        insuranceCardNumber: body.insuranceCardNumber,
        coverageType: body.coverageType,
        coverageStart: body.coverageStart || null,
        coverageEnd: body.coverageEnd || null,
        coverageStatus: body.coverageStatus,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, patientId));

    await audit(session, {
      action: "modifier",
      entity: "patient",
      entityId: patientId,
      patientId,
      detail: `Mise à jour de la fiche patient #${patientId}`,
    });

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
    const patientId = parseInt(id);
    await db
      .delete(patients)
      .where(eq(patients.id, patientId));

    await audit(session, {
      action: "supprimer",
      entity: "patient",
      entityId: patientId,
      patientId,
      detail: `Suppression de la fiche patient #${patientId}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete patient error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
