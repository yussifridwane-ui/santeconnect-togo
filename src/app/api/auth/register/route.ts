import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, patients, facilities, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, setSession } from "@/lib/auth";
import { TRIAL_DAYS } from "@/lib/plans";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, password, phone, role, facilityId, createFacilityName, facilityCity, facilityAddress } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    let finalFacilityId = facilityId ? parseInt(facilityId) : null;

    // Create a new facility if requested
    if (role !== "patient" && createFacilityName) {
      const newFacility = await db
        .insert(facilities)
        .values({
          name: createFacilityName,
          type: "clinic",
          description: `Cabinet médical créé par ${fullName}`,
          city: facilityCity || "Lomé",
          address: facilityAddress || "Togo",
          phone: phone || "+228 90 00 00 00",
          email: email,
        })
        .returning();
      finalFacilityId = newFacility[0].id;
    }

    const newUser = await db
      .insert(users)
      .values({
        fullName,
        email,
        password: hashedPassword,
        phone: phone || null,
        role: role || "patient",
        facilityId: finalFacilityId,
      })
      .returning();

    // Démarrage automatique de l'essai gratuit Pro (14 jours) pour tout nouveau cabinet
    if (finalFacilityId && role !== "patient") {
      await db.insert(subscriptions).values({
        facilityId: finalFacilityId,
        planId: "pro",
        billingCycle: "monthly",
        status: "trialing",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
      });
    }

    await setSession({
      id: newUser[0].id,
      fullName: newUser[0].fullName,
      email: newUser[0].email,
      role: newUser[0].role,
      facilityId: newUser[0].facilityId,
    });

    if (role === "patient") {
      await db.insert(patients).values({
        userId: newUser[0].id,
        facilityId: finalFacilityId || 1, // Default to clinic 1
        dateOfBirth: new Date("2000-01-01"),
      });
    }

    return NextResponse.json(
      {
        user: {
          id: newUser[0].id,
          fullName: newUser[0].fullName,
          email: newUser[0].email,
          role: newUser[0].role,
          facilityId: newUser[0].facilityId,
          phone: newUser[0].phone,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
