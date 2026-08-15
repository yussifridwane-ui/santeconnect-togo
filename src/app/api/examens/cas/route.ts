import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

function parseOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const v = JSON.parse(String(raw || "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/examens/cas — cas cliniques pédagogiques.
 * La réponse juste est masquée dans l'interface jusqu'à ce que l'utilisateur
 * choisisse : ensuite l'analyse complète s'affiche (apprentissage par l'erreur).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role === "patient") {
      return NextResponse.json({ error: "Module réservé aux professionnels de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const result = await pool.query(
      `SELECT c.slug, c.title, c.category, c.vignette, c.question, c.options, c.correct_index, c.analysis, c.exam_slug,
              e.name AS exam_name
       FROM exam_cases c
       LEFT JOIN exam_library e ON e.slug = c.exam_slug
       ORDER BY c.id`,
    );

    return NextResponse.json({
      cases: result.rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        category: r.category,
        vignette: r.vignette,
        question: r.question,
        options: parseOptions(r.options),
        correctIndex: r.correct_index,
        analysis: r.analysis,
        examSlug: r.exam_slug,
        examName: r.exam_name,
      })),
    });
  } catch (error) {
    console.error("Get cas cliniques error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
