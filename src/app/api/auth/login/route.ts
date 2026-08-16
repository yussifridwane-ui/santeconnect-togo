import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, facilities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, setSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";
import { sql } from "drizzle-orm";

/* 🔐 V2.8 — Verrouillage anti brute-force PERSISTANT (base de données) :
   5 échecs → compte gelé 15 minutes, survit aux instances serverless.
   La mémoire ci-dessous reste une première ligne de défense (IP+e-mail). */

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

    await ensureMigrated();

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

    /* Verrou PERSISTANT : la colonne login_locked_until prime sur la mémoire */
    const lockRow = user.length
      ? await db.execute(sql`SELECT login_locked_until FROM users WHERE id = ${user[0].id}`)
      : null;
    const lockedUntil: string | null = lockRow && (lockRow as unknown as { rows: { login_locked_until: string | null }[] }).rows?.length
      ? (lockRow as unknown as { rows: { login_locked_until: string | null }[] }).rows[0].login_locked_until
      : null;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      const minutes = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Compte temporairement verrouillé (trop de tentatives). Réessayez dans ${minutes} minute(s).` },
        { status: 429 },
      );
    }

    const wrongCredentials = async () => {
      const cur = attempts.get(key) || { fails: 0, lockedUntil: 0 };
      cur.fails += 1;
      if (cur.fails >= MAX_FAILS) {
        cur.lockedUntil = Date.now() + LOCK_MS;
        cur.fails = 0;
      }
      attempts.set(key, cur);
      /* 🛡️ Verrou PERSISTANT en base : survit aux instances serverless */
      if (user.length > 0) {
        try {
          await db.execute(sql`
            UPDATE users
            SET login_fails = COALESCE(login_fails, 0) + 1,
                login_locked_until = CASE
                  WHEN COALESCE(login_fails, 0) + 1 >= 5
                  THEN now() + interval '15 minutes'
                  ELSE login_locked_until END
            WHERE id = ${user[0].id}`);
        } catch (e) {
          console.error("[login] persistance verrou:", e);
        }
        const dbFails = await db.execute(sql`SELECT login_fails, login_locked_until FROM users WHERE id = ${user[0].id}`);
        const row = (dbFails as unknown as { rows: { login_fails: number; login_locked_until: string | null }[] }).rows?.[0];
        if (row?.login_locked_until && new Date(row.login_locked_until).getTime() > Date.now()) {
          await audit(
            { id: user[0].id, fullName: user[0].fullName, email: user[0].email, role: user[0].role, facilityId: user[0].facilityId },
            { action: "refus", entity: "utilisateur", entityId: user[0].id, detail: "Compte verrouillé 15 min après 5 échecs de connexion" },
          );
          return NextResponse.json(
            { error: "Trop de tentatives. Compte verrouillé 15 minutes." },
            { status: 429 },
          );
        }
      }
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

    attempts.delete(key); // connexion réussie : compteurs remis à zéro (mémoire + base)
    try {
      await db.execute(sql`UPDATE users SET login_fails = 0, login_locked_until = NULL WHERE id = ${user[0].id}`);
    } catch { /* non bloquant */ }

    await audit(
      { id: user[0].id, fullName: user[0].fullName, email: user[0].email, role: user[0].role, facilityId: user[0].facilityId },
      { action: "connexion", entity: "utilisateur", entityId: user[0].id, detail: "Connexion réussie" },
    );

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
