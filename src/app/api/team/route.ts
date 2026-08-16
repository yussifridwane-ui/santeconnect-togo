import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession, hashPassword } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * 👥 GESTION D'ÉQUIPE (V2.5 — Gestion de cabinet)
 * Réservé à l'ADMIN de l'établissement.
 * GET  → tout le personnel de SON établissement (jamais celui des autres).
 * POST → crée un compte membre : médecin, infirmier, secrétaire, labo,
 *        pharmacien, admin — avec mot de passe initial immédiatement haché.
 */

const ALLOWED_ROLES = ["doctor", "nurse", "secretary", "lab", "pharmacist", "admin"];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
    }
    await ensureMigrated();

    const rows = await pool.query(
      `SELECT id, full_name, email, phone, role, is_active, created_at
       FROM users WHERE facility_id = $1 AND role <> 'patient'
       ORDER BY is_active DESC, created_at ASC`,
      [session.facilityId || -1],
    );
    return NextResponse.json({ items: rows.rows });
  } catch (e) {
    console.error("team GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
    }
    await ensureMigrated();

    const body = await request.json();
    const fullName = String(body.fullName || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const phone = body.phone ? String(body.phone).trim().slice(0, 30) : null;
    const role = String(body.role || "");
    const password = String(body.password || "");

    if (!fullName || !email.includes("@") || password.length < 6) {
      return NextResponse.json(
        { error: "Nom, e-mail valide et mot de passe (6 caractères min.) obligatoires." },
        { status: 400 },
      );
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rôle non autorisé." }, { status: 400 });
    }

    const dup = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: "Cet e-mail est déjà utilisé." }, { status: 409 });
    }

    const hash = await hashPassword(password);
    const ins = await pool.query(
      `INSERT INTO users (full_name, email, password, phone, role, facility_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
      [fullName, email, hash, phone, role, session.facilityId || null],
    );

    await audit(session, {
      action: "creer",
      entity: "utilisateur",
      entityId: ins.rows[0]?.id,
      detail: `Compte créé : ${fullName} (${role}) — ${email}`,
    });

    return NextResponse.json({ ok: true, id: ins.rows[0]?.id }, { status: 201 });
  } catch (e) {
    console.error("team POST:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
