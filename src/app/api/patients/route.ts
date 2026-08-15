import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession, hashPassword } from "@/lib/auth";
import { ensureSubscription, computeState, getUsage } from "@/lib/billing";
import { getPlan } from "@/lib/plans";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await ensureMigrated();
    const facilityId = session.facilityId || 1;

    const result = await db
      .select({
        id: patients.id,
        userId: patients.userId,
        facilityId: patients.facilityId,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        dateOfBirth: patients.dateOfBirth,
        gender: patients.gender,
        bloodType: patients.bloodType,
        address: patients.address,
        emergencyContact: patients.emergencyContact,
        emergencyPhone: patients.emergencyPhone,
        insuranceNumber: patients.insuranceNumber,
        medicalNotes: patients.medicalNotes,
        recordNumber: patients.recordNumber,
        city: patients.city,
        insurerName: patients.insurerName,
        insuredNumber: patients.insuredNumber,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .leftJoin(users, eq(patients.userId, users.id))
      .where(eq(patients.facilityId, facilityId));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get patients error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/* N° de dossier unique : DOS-<cabinet>-XXXXXX (ex. DOS-1-7K3Q9B) */
async function generateRecordNumber(facilityId: number): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const candidate = `DOS-${facilityId}-${suffix}`;
    const exists = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.recordNumber, candidate))
      .limit(1);
    if (exists.length === 0) return candidate;
  }
  return `DOS-${facilityId}-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await ensureMigrated();
    const facilityId = session.facilityId || 1;
    const body = await request.json();

    // Garde-fou SaaS : abonnement actif + limite de patients de la formule
    const sub = await ensureSubscription(facilityId);
    const state = computeState(sub);
    if (!state.allowed) {
      return NextResponse.json({ error: state.message }, { status: 403 });
    }
    const usage = await getUsage(facilityId);
    const plan = getPlan(sub.planId);
    if (usage.patients >= plan.maxPatients) {
      return NextResponse.json(
        {
          error: `Limite de ${plan.maxPatients} patients atteinte avec la formule ${plan.name}. Passez à la formule supérieure dans Facturation.`,
        },
        { status: 403 }
      );
    }

    // Use a unique random email if not provided
    const randomEmail = body.email || `patient-${Date.now()}-${Math.floor(Math.random() * 1000)}@santeconnect.tg`;

    // Mot de passe provisoire aléatoire et haché (jamais affiché ni publié)
    const temporaryHashedPassword = await hashPassword(
      `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const newUser = await db
      .insert(users)
      .values({
        fullName: body.fullName,
        email: randomEmail,
        password: temporaryHashedPassword,
        phone: body.phone || null,
        role: "patient",
        facilityId: facilityId,
      })
      .returning();

    const recordNumber = body.recordNumber || (await generateRecordNumber(facilityId));

    const newPatient = await db
      .insert(patients)
      .values({
        userId: newUser[0].id,
        facilityId: facilityId,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : new Date("2000-01-01"),
        gender: body.gender || "male",
        bloodType: body.bloodType || "O+",
        address: body.address || "",
        emergencyContact: body.emergencyContact || "",
        emergencyPhone: body.emergencyPhone || "",
        insuranceNumber: body.insuranceNumber || "",
        medicalNotes: body.medicalNotes || "",
        /* Fiche complète SantéOnline v2 — tous facultatifs */
        recordNumber,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        usageName: body.usageName || null,
        placeOfBirth: body.placeOfBirth || null,
        nationality: body.nationality || "Togolaise",
        idType: body.idType || null,
        idNumber: body.idNumber || null,
        photoUrl: body.photoUrl || null,
        phoneSecondary: body.phoneSecondary || null,
        whatsapp: body.whatsapp || null,
        country: body.country || "Togo",
        region: body.region || null,
        city: body.city || null,
        commune: body.commune || null,
        quartier: body.quartier || null,
        street: body.street || null,
        houseNumber: body.houseNumber || null,
        landmark: body.landmark || null,
        addressFull: body.addressFull || null,
        maritalStatus: body.maritalStatus || null,
        spouseName: body.spouseName || null,
        spousePhone: body.spousePhone || null,
        childrenCount: body.childrenCount ? Number(body.childrenCount) : null,
        emergencyName: body.emergencyName || null,
        emergencyRelation: body.emergencyRelation || null,
        emergencyPhoneSecondary: body.emergencyPhoneSecondary || null,
        emergencyWhatsapp: body.emergencyWhatsapp || null,
        emergencyAddress: body.emergencyAddress || null,
        emergencyCity: body.emergencyCity || null,
        profession: body.profession || null,
        employer: body.employer || null,
        workPhone: body.workPhone || null,
        workEmail: body.workEmail || null,
        workAddress: body.workAddress || null,
        workCity: body.workCity || null,
        insurerName: body.insurerName || null,
        insuredNumber: body.insuredNumber || null,
        insuranceCardNumber: body.insuranceCardNumber || null,
        coverageType: body.coverageType || null,
        coverageStart: body.coverageStart || null,
        coverageEnd: body.coverageEnd || null,
        coverageStatus: body.coverageStatus || null,
      })
      .returning();

    await audit(session, {
      action: "creer",
      entity: "patient",
      entityId: newPatient[0].id,
      patientId: newPatient[0].id,
      detail: `Création du patient ${newUser[0].fullName} (${recordNumber})`,
    });

    return NextResponse.json(
      {
        id: newPatient[0].id,
        userId: newPatient[0].userId,
        facilityId: newPatient[0].facilityId,
        fullName: newUser[0].fullName,
        email: newUser[0].email,
        phone: newUser[0].phone,
        dateOfBirth: newPatient[0].dateOfBirth,
        gender: newPatient[0].gender,
        bloodType: newPatient[0].bloodType,
        address: newPatient[0].address,
        emergencyContact: newPatient[0].emergencyContact,
        emergencyPhone: newPatient[0].emergencyPhone,
        insuranceNumber: newPatient[0].insuranceNumber,
        medicalNotes: newPatient[0].medicalNotes,
        recordNumber: newPatient[0].recordNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create patient error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
