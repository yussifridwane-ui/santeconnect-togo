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
 * GET /api/examens/quiz — une série de QCM piochés au hasard.
 * ?category=biologie (optionnel) — 10 questions par série.
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
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") || "").trim();

    const result = category
      ? await pool.query(
          `SELECT id, category, question, options, correct_index, explanation, exam_slug
           FROM exam_quiz WHERE category = $1 ORDER BY RANDOM() LIMIT 10`,
          [category],
        )
      : await pool.query(
          `SELECT id, category, question, options, correct_index, explanation, exam_slug
           FROM exam_quiz ORDER BY RANDOM() LIMIT 10`,
        );

    return NextResponse.json({
      questions: result.rows.map((r) => ({
        id: r.id,
        category: r.category,
        question: r.question,
        options: parseOptions(r.options),
        correctIndex: r.correct_index,
        explanation: r.explanation,
        examSlug: r.exam_slug,
      })),
    });
  } catch (error) {
    console.error("Get quiz error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
