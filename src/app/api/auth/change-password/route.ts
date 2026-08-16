import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession, verifyPassword, hashPassword, rateLimit } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";

/* ════════════════════════════════════════════════════════════════════
   🔑 V3.0 — LE VRAI MOTEUR DU CHANGEMENT DE MOT DE PASSE
   ─ Vérifie l'ANCIEN mot de passe (bcrypt) : personne ne peut changer
     le mot de passe d'un compte sans en connaître le secret actuel.
   ─ Chiffre le NOUVEAU (bcrypt) : jamais stocké ni lisible en clair,
     ni par nous, ni par quiconque lirait la base un jour.
   ─ ANTI BRUTE-FORCE persistant (réutilise les colonnes V2.8) :
     5 échecs sur l'ancien → gel 15 minutes, en BASE (survit aux
     instances serverless), + garde-fou mémoire 10 essais/heure.
   ─ Traçabilité journal : succès et refus — MAIS JAMAIS le contenu
     des mots de passe (pas même leur longueur).
   ════════════════════════════════════════════════════════════════════ */

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    /* Garde-fou mémoire : 10 changements/heure/compte (première ligne) */
    if (!rateLimit(`pwd:${session.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Trop de tentatives de changement. Réessayez plus tard." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Les trois champs sont obligatoires." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit contenir au moins 6 caractères." },
        { status: 400 },
      );
    }
    if (newPassword.length > 100) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe est trop long (100 caractères maximum)." },
        { status: 400 },
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "La confirmation ne correspond pas au nouveau mot de passe." },
        { status: 400 },
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit être différent de l'ancien." },
        { status: 400 },
      );
    }

    await ensureMigrated();

    const r = await pool.query(
      `SELECT password, login_fails, login_locked_until FROM users WHERE id = $1`,
      [session.id],
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    const row = r.rows[0];

    /* Verrou persistant : gel actif ? */
    if (row.login_locked_until && new Date(row.login_locked_until).getTime() > Date.now()) {
      const minutes = Math.ceil((new Date(row.login_locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Compte temporairement verrouillé. Réessayez dans ${minutes} minute(s).` },
        { status: 429 },
      );
    }

    /* LA vérification-clé : l'ancien mot de passe doit être le BON */
    const ok = await verifyPassword(currentPassword, String(row.password || ""));
    if (!ok) {
      const fails = (Number(row.login_fails) || 0) + 1;
      const lock = fails >= MAX_FAILS;
      await pool.query(
        `UPDATE users
         SET login_fails = $2,
             login_locked_until = CASE WHEN $3 THEN now() + interval '15 minutes' ELSE login_locked_until END
         WHERE id = $1`,
        [session.id, lock ? 0 : fails, lock],
      );
      await audit(session, {
        action: "refus",
        entity: "parametre",
        entityId: session.id,
        detail: lock
          ? "Changement de mot de passe refusé : ancien mot de passe erroné — compte gelé 15 min après 5 échecs"
          : "Changement de mot de passe refusé : ancien mot de passe erroné",
      });
      if (lock) {
        return NextResponse.json(
          { error: "Trop de tentatives erronées. Compte gelé 15 minutes par sécurité." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "Le mot de passe actuel saisi est incorrect." },
        { status: 400 },
      );
    }

    /* Succès : chiffrement bcrypt du NOUVEAU secret + remise à zéro des compteurs */
    const hashed = await hashPassword(newPassword);
    await pool.query(
      `UPDATE users SET password = $2, login_fails = 0, login_locked_until = NULL WHERE id = $1`,
      [session.id, hashed],
    );

    await audit(session, {
      action: "modifier",
      entity: "parametre",
      entityId: session.id,
      detail: "Mot de passe du compte modifié avec succès (aucune valeur en clair journalisée)",
    });

    return NextResponse.json({
      success: true,
      message: "Mot de passe changé avec succès — actif dès votre prochaine connexion.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
