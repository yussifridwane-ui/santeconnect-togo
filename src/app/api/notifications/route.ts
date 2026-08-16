import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/**
 * 🔔 CENTRE DE NOTIFICATIONS (V2.5)
 * GET → les 30 dernières notifications du compte connecté + nombre de non lues
 * PUT → { id } marque une notification lue · { all: true } marque tout comme lu
 * Rappels automatisés : RDV (V2.3), demandes de RDV en ligne, paiements de
 * factures, factures en retard → tout aboutit ici.
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    await ensureMigrated();

    const rows = await pool.query(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [session.id],
    );
    const unread = await pool.query(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false`,
      [session.id],
    );
    return NextResponse.json({ items: rows.rows, unreadCount: unread.rows[0]?.n ?? 0 });
  } catch (e) {
    console.error("notifications GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    await ensureMigrated();

    const body = await request.json().catch(() => ({}));
    if (body.all) {
      await pool.query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [session.id],
      );
    } else if (body.id) {
      await pool.query(
        `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
        [parseInt(body.id), session.id],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("notifications PUT:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
