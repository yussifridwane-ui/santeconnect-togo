import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, patients, facilities } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession, hashPassword } from "@/lib/auth";
import { ensureSubscription, computeState, getUsage } from "@/lib/billing";
import { getPlan } from "@/lib/plans";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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
      })
      .returning();

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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create patient error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
