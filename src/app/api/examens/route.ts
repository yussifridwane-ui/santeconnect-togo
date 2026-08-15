import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

const CATEGORIES = ["biologie", "imagerie", "cardiologie", "explorations", "endoscopie", "anapath"];

function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || `fiche-${Date.now()}`;
}

function mapExam(r: Record<string, unknown>) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    status: r.status,
    definition: r.definition,
    updatedOn: r.updated_on,
    isFavorite: !!r.is_favorite,
    lastViewed: r.last_viewed ?? null,
  };
}

/**
 * GET /api/examens — liste de la bibliothèque (recherche + filtres + favoris + historique).
 * Réservé aux soignants : le contenu pédagogique clinique n'est pas destiné aux patients.
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
    const q = (searchParams.get("q") || "").trim();
    const category = (searchParams.get("category") || "").trim();
    const favorites = searchParams.get("favorites") === "1";
    const history = searchParams.get("history") === "1";

    /* Historique personnel : dernières fiches consultées, les plus récentes d'abord */
    if (history) {
      const result = await pool.query(
        `SELECT e.id, e.slug, e.name, e.category, e.status, e.definition, e.updated_on,
                MAX(h.viewed_at) AS last_viewed,
                EXISTS(SELECT 1 FROM exam_favorites f WHERE f.exam_id = e.id AND f.user_id = $1) AS is_favorite
         FROM exam_history h
         JOIN exam_library e ON e.id = h.exam_id
         WHERE h.user_id = $1
         GROUP BY e.id
         ORDER BY MAX(h.viewed_at) DESC
         LIMIT 40`,
        [session.id],
      );
      return NextResponse.json({ exams: result.rows.map(mapExam) });
    }

    const conds: string[] = [];
    const values: (string | number | boolean)[] = [session.id];
    let sql = `SELECT e.id, e.slug, e.name, e.category, e.status, e.definition, e.updated_on,
                EXISTS(SELECT 1 FROM exam_favorites f WHERE f.exam_id = e.id AND f.user_id = $1) AS is_favorite
         FROM exam_library e`;

    if (favorites) {
      sql += ` JOIN exam_favorites fav ON fav.exam_id = e.id AND fav.user_id = $1`;
    }
    /* Les non-admins ne voient que les fiches publiées */
    if (session.role !== "admin") {
      conds.push(`e.status = 'published'`);
    }
    if (q) {
      values.push(`%${q}%`);
      conds.push(`(e.name ILIKE $${values.length} OR e.definition ILIKE $${values.length} OR e.parameters ILIKE $${values.length})`);
    }
    if (category && CATEGORIES.includes(category)) {
      values.push(category);
      conds.push(`e.category = $${values.length}`);
    }
    if (conds.length) sql += ` WHERE ` + conds.join(" AND ");
    sql += ` ORDER BY e.category, e.name`;

    const result = await pool.query(sql, values);
    return NextResponse.json({ exams: result.rows.map(mapExam) });
  } catch (error) {
    console.error("Get examens error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/examens — création d'une fiche (administrateur uniquement).
 * ADDITIF : jamais d'écrasement, un conflit de slug renvoie 409.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
    }

    await ensureMigrated();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const category = CATEGORIES.includes(body.category) ? body.category : "biologie";
    const definition = String(body.definition || "").trim();
    if (!name || !definition) {
      return NextResponse.json({ error: "Nom et définition obligatoires" }, { status: 400 });
    }

    const slug = String(body.slug || "").trim() || slugify(name);
    const status = body.status === "draft" ? "draft" : "published";

    const r = await pool.query(
      `INSERT INTO exam_library (slug, name, category, status, definition, objective, indications, contraindications,
        preparation, procedure_text, materials, parameters, reference_values, interpretation, anomalies, limitations,
        references_text, updated_on, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, COALESCE($18::date, CURRENT_DATE), $19)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id, slug`,
      [
        slug,
        name,
        category,
        status,
        definition,
        body.objective || null,
        body.indications || null,
        body.contraindications || null,
        body.preparation || null,
        body.procedureText || null,
        body.materials || null,
        body.parameters || null,
        body.referenceValues || null,
        body.interpretation || null,
        body.anomalies || null,
        body.limitations || null,
        body.references || null,
        body.updatedOn || null,
        session.id,
      ],
    );

    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Une fiche avec cet identifiant (slug) existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ success: true, slug: r.rows[0].slug }, { status: 201 });
  } catch (error) {
    console.error("Create exam error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
