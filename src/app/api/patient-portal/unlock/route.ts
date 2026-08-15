import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";
import { signDossierToken } from "@/lib/dossier";

const MAX_FAILS = 5;
const LOCK_MINUTES = 10;

/**
 * POST /api/patient-portal/unlock — le patient tape son code.
 * 5 échecs → dossier gelé 10 minutes (compteur EN BASE, fiable même en serverless).
 * Succès → jeton dossier signé de 15 minutes, qui n'ouvre QUE son propre dossier.
 */
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
    const r = await pool.query(
      `SELECT id, dossier_code_hash, dossier_fails, dossier_locked_until FROM patients WHERE user_id = $1`,
      [session.id],
    );
    const p = r.rows[0];
    if (!p) {
      return NextResponse.json(
        { error: "Aucun dossier n'est lié à ton compte — rapproche-toi de ton centre de santé." },
        { status: 404 },
      );
    }
    if (!p.dossier_code_hash) {
      return NextResponse.json({ error: "Crée d'abord ton code de dossier.", needSetup: true }, { status: 409 });
    }

    /* Verrou temporaire actif ? */
    if (p.dossier_locked_until && new Date(p.dossier_locked_until) > new Date()) {
      const min = Math.ceil((new Date(p.dossier_locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Dossier temporairement verrouillé après 5 essais. Réessaie dans ${min} min.` },
        { status: 423 },
      );
    }

    const { code } = await request.json();
    const ok = await bcrypt.compare(String(code || ""), p.dossier_code_hash);

    if (!ok) {
      const fails = (p.dossier_fails || 0) + 1;
      if (fails >= MAX_FAILS) {
        await pool.query(
          `UPDATE patients SET dossier_fails = 0, dossier_locked_until = now() + interval '${LOCK_MINUTES} minutes' WHERE id = $1`,
          [p.id],
        );
        await audit(session, {
          action: "refus",
          entity: "dossier",
          patientId: p.id,
          detail: `5 échecs de code dossier → verrouillage ${LOCK_MINUTES} minutes (sécurité)`,
        });
        return NextResponse.json(
          { error: `Trop d'essais. Dossier verrouillé ${LOCK_MINUTES} minutes.` },
          { status: 423 },
        );
      }
      await pool.query(`UPDATE patients SET dossier_fails = $2 WHERE id = $1`, [p.id, fails]);
      return NextResponse.json(
        { error: `Code incorrect. ${MAX_FAILS - fails} essai${MAX_FAILS - fails > 1 ? "s" : ""} restant${MAX_FAILS - fails > 1 ? "s" : ""}.` },
        { status: 403 },
      );
    }

    await pool.query(`UPDATE patients SET dossier_fails = 0, dossier_locked_until = NULL WHERE id = $1`, [p.id]);
    const dossierToken = await signDossierToken(p.id, session.id);

    await audit(session, {
      action: "consulter",
      entity: "dossier",
      patientId: p.id,
      detail: `Le patient a déverrouillé son dossier avec son code`,
    });

    return NextResponse.json({ dossierToken, expiresIn: 900 });
  } catch (error) {
    console.error("Portal unlock error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
