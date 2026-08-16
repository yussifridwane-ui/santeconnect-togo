import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession, hashPassword } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/**
 * 👥 GESTION D'ÉQUIPE — MEMBRE INDIVIDUEL (V2.5)
 * PUT → admin seulement, même établissement :
 *   { role }           → change le rôle
 *   { isActive }       → active / désactive l'accès (aucune suppression de compte)
 *   { password }       → réinitialise le mot de passe (haché immédiatement)
 * Garde-fous : on ne peut pas se désactiver soi-même ni rétrograder le dernier
 * admin actif de l'établissement.
 */

const ALLOWED_ROLES = ["doctor", "nurse", "secretary", "lab", "pharmacist", "admin"];

interface Ctx { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
    }
    await ensureMigrated();

    const { id } = await params;
    const targetId = parseInt(id);
    const body = await request.json();

    const cur = await pool.query(
      `SELECT id, full_name, role, facility_id, is_active FROM users WHERE id = $1`,
      [targetId],
    );
    const target = cur.rows[0];
    if (!target) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
    if (target.facility_id !== session.facilityId) {
      return NextResponse.json({ error: "Ce membre appartient à un autre établissement." }, { status: 403 });
    }
    if (targetId === session.id && (body.isActive === false || (body.role && body.role !== "admin"))) {
      return NextResponse.json(
        { error: "Tu ne peux pas te désactiver ou te rétrograder toi-même." },
        { status: 400 },
      );
    }

    const changes: string[] = [];

    if (typeof body.isActive === "boolean" && body.isActive !== target.is_active) {
      if (body.isActive === false) {
        const admins = await pool.query(
          `SELECT COUNT(*)::int AS n FROM users
           WHERE facility_id = $1 AND role = 'admin' AND is_active = true AND id <> $2`,
          [session.facilityId, targetId],
        );
        if (target.role === "admin" && (admins.rows[0]?.n ?? 0) === 0) {
          return NextResponse.json(
            { error: "Impossible : c'est le dernier administrateur actif de l'établissement." },
            { status: 400 },
          );
        }
      }
      await pool.query(`UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2`, [
        body.isActive, targetId,
      ]);
      changes.push(body.isActive ? "compte réactivé" : "compte désactivé");
    }

    if (body.role && ALLOWED_ROLES.includes(String(body.role)) && body.role !== target.role) {
      if (target.role === "admin" && body.role !== "admin") {
        const admins = await pool.query(
          `SELECT COUNT(*)::int AS n FROM users
           WHERE facility_id = $1 AND role = 'admin' AND is_active = true AND id <> $2`,
          [session.facilityId, targetId],
        );
        if (target.is_active && (admins.rows[0]?.n ?? 0) === 0) {
          return NextResponse.json(
            { error: "Impossible : c'est le dernier administrateur actif de l'établissement." },
            { status: 400 },
          );
        }
      }
      await pool.query(`UPDATE users SET role = $1, updated_at = now() WHERE id = $2`, [
        String(body.role), targetId,
      ]);
      changes.push(`rôle → ${body.role}`);
    }

    if (body.password) {
      const pwd = String(body.password);
      if (pwd.length < 6) {
        return NextResponse.json({ error: "Mot de passe : 6 caractères minimum." }, { status: 400 });
      }
      const hash = await hashPassword(pwd);
      await pool.query(`UPDATE users SET password = $1, updated_at = now() WHERE id = $2`, [
        hash, targetId,
      ]);
      changes.push("mot de passe réinitialisé");
    }

    if (changes.length === 0) {
      return NextResponse.json({ error: "Aucune modification demandée." }, { status: 400 });
    }

    await audit(session, {
      action: "modifier",
      entity: "utilisateur",
      entityId: targetId,
      detail: `${target.full_name} : ${changes.join(", ")}`,
    });

    return NextResponse.json({ ok: true, changes });
  } catch (e) {
    console.error("team PUT:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
