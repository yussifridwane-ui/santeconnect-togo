import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, facilities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, setSession } from "@/lib/auth";

/* Limitation des tentatives de connexion (anti brute-force, en mémoire du serveur).
   5 échecs sur la même adresse → pause de 5 minutes. */
const attempts = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

function clientKey(request: NextRequest, email: string): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || "inconnu";
  return `${ip}:${String(email).toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    const key = clientKey(request, email);
    const rec = attempts.get(key);
    if (rec && rec.lockedUntil > Date.now()) {
      const minutes = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const wrongCredentials = () => {
      const cur = attempts.get(key) || { fails: 0, lockedUntil: 0 };
      cur.fails += 1;
      if (cur.fails >= MAX_FAILS) {
        cur.lockedUntil = Date.now() + LOCK_MS;
        cur.fails = 0;
      }
      attempts.set(key, cur);
      return NextResponse.json(
        { error: "Identifiants incorrects" },
        { status: 401 }
      );
    };

    if (user.length === 0) {
      return wrongCredentials();
    }

    const isValid = await verifyPassword(password, user[0].password);
    if (!isValid) {
      return wrongCredentials();
    }

    if (!user[0].isActive) {
      return NextResponse.json(
        { error: "Compte désactivé" },
        { status: 403 }
      );
    }

    attempts.delete(key); // connexion réussie : compteur remis à zéro

    await setSession({
      id: user[0].id,
      fullName: user[0].fullName,
      email: user[0].email,
      role: user[0].role,
      facilityId: user[0].facilityId,
    });

    return NextResponse.json({
      user: {
        id: user[0].id,
        fullName: user[0].fullName,
        email: user[0].email,
        role: user[0].role,
        facilityId: user[0].facilityId,
        phone: user[0].phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
