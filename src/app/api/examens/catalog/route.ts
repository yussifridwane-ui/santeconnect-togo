import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/**
 * GET /api/examens/catalog — liste compacte (slug/nom/catégorie) des examens publiés.
 * Sert à la saisie rapide quand un médecin demande un examen AU PATIENT.
 * Réservé aux soignants.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role === "patient") {
      return NextResponse.json({ error: "Réservé aux professionnels de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const result = await pool.query(
      `SELECT slug, name, category FROM exam_library WHERE status = 'published' ORDER BY category, name`
    );
    return NextResponse.json({ catalog: result.rows });
  } catch (error) {
    console.error("Get catalog error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
