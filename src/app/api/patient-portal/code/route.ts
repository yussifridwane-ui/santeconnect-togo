import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * CODE DOSSIER PATIENT — V2.2 (style T-Money).
 * GET : le patient sait s'il a déjà créé son code.
 * POST : il le CRÉE lui-même à sa première connexion (haché bcrypt, jamais stocké en clair).
 */
async function ownPatient(userId: number) {
  const r = await pool.query(
    `SELECT id, dossier_code_hash FROM patients WHERE user_id = $1`,
    [userId],
  );
  return r.rows[0] || null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "patient") {
      return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });
    }

    await ensureMigrated();
    const p = await ownPatient(session.id);
    return NextResponse.json({
      hasDossier: !!p,
      hasCode: !!(p && p.dossier_code_hash),
    });
  } catch (error) {
    console.error("Portal code status error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "patient") {
      return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });
    }

    await ensureMigrated();
    const p = await ownPatient(session.id);
    if (!p) {
      return NextResponse.json(
        { error: "Aucun dossier n'est encore lié à ton compte — rapproche-toi de ton centre de santé." },
        { status: 404 },
      );
    }
    if (p.dossier_code_hash) {
      return NextResponse.json(
        { error: "Tu as déjà un code. Oublié ? Demande à ton médecin de le réinitialiser." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const code = String(body.code || "");
    const confirm = String(body.confirm || "");
    if (!/^\d{4,6}$/.test(code)) {
      return NextResponse.json({ error: "Le code doit contenir 4 à 6 chiffres." }, { status: 400 });
    }
    if (code !== confirm) {
      return NextResponse.json({ error: "Les deux codes ne correspondent pas." }, { status: 400 });
    }

    const hash = await bcrypt.hash(code, 10);
    await pool.query(
      `UPDATE patients SET dossier_code_hash = $2, dossier_code_set_at = now(),
        dossier_fails = 0, dossier_locked_until = NULL
       WHERE id = $1`,
      [p.id, hash],
    );

    await audit(session, {
      action: "creer",
      entity: "patient",
      entityId: p.id,
      patientId: p.id,
      detail: `Le patient a créé son code dossier (jamais stocké en clair)`,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Portal create code error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
