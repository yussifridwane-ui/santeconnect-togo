import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

async function guard() {
  const session = await getSession();
  if (!session) {
    return { session: null, res: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  if (session.role === "patient") {
    return { session: null, res: NextResponse.json({ error: "Module réservé aux professionnels de santé" }, { status: 403 }) };
  }
  await ensureMigrated();
  return { session, res: null };
}

/** POST — ajouter la fiche aux favoris (idempotent). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, res } = await guard();
    if (res) return res;
    const { slug } = await params;

    const found = await pool.query(`SELECT id FROM exam_library WHERE slug = $1`, [slug]);
    if (found.rows.length === 0) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    await pool.query(
      `INSERT INTO exam_favorites (user_id, exam_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [session!.id, found.rows[0].id],
    );
    return NextResponse.json({ success: true, isFavorite: true });
  } catch (error) {
    console.error("Add favorite error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** DELETE — retirer la fiche des favoris. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, res } = await guard();
    if (res) return res;
    const { slug } = await params;

    await pool.query(
      `DELETE FROM exam_favorites WHERE user_id = $1
       AND exam_id IN (SELECT id FROM exam_library WHERE slug = $2)`,
      [session!.id, slug],
    );
    return NextResponse.json({ success: true, isFavorite: false });
  } catch (error) {
    console.error("Remove favorite error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
