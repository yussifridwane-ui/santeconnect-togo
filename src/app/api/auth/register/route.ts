import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, patients, facilities, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, setSession, rateLimit } from "@/lib/auth";
import { TRIAL_DAYS } from "@/lib/plans";
import { audit } from "@/lib/audit";

/* 🔐 Rôles ouverts à l'inscription publique :
   - patient    : libre
   - admin      : UNIQUEMENT en créant son propre établissement (porteur de cabinet)
   Jamais doctor/nurse/secretary/lab/pharmacist ici : ces comptes naissent
   exclusivement via Gestion d'équipe (V2.5), par l'admin du centre. */
const REGISTERABLE = new Set(["patient", "admin"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, password, phone, createFacilityName, facilityCity, facilityAddress } = body;

    /* Anti-spam : max 5 créations de compte / heure / IP (best effort serverless) */
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Trop de créations de compte. Réessayez plus tard." }, { status: 429 });
    }

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Mot de passe : 6 caractères minimum" },
        { status: 400 }
      );
    }

    /* 🛡️ V2.8 — on ne fait JAMAIS confiance au rôle ni au facilityId du client */
    const safeRole = REGISTERABLE.has(String(body.role)) ? String(body.role) : "patient";
    if (safeRole === "admin" && !createFacilityName) {
      return NextResponse.json(
        { error: "Pour un compte administrateur, crée d'abord ton établissement." },
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
    /* 🛡️ V2.8 — RATACHÉ D'OFFICE : un nouvel inscrit n'est jamais rattaché à un
       établissement EXISTANT par un simple facilityId envoyé par le client.
       Seule voie : créer SON propre établissement (admin). */
    let finalFacilityId: number | null = null;

    // Create a new facility if requested (nouveau cabinet = nouveau compte admin)
    if (safeRole === "admin" && createFacilityName) {
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
        role: safeRole,
        facilityId: finalFacilityId,
      })
      .returning();

    // Démarrage automatique de l'essai gratuit Pro (14 jours) pour tout nouveau cabinet
    if (finalFacilityId && safeRole === "admin") {
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

    await audit(
      { id: newUser[0].id, fullName: newUser[0].fullName, email: newUser[0].email, role: newUser[0].role, facilityId: newUser[0].facilityId },
      { action: "creer", entity: "utilisateur", entityId: newUser[0].id, detail: `Inscription publique (${safeRole})` },
    );

    if (safeRole === "patient") {
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
