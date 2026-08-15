import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/** GET — fiche détaillée ; chaque consultation alimente l'historique personnel. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role === "patient") {
      return NextResponse.json({ error: "Module réservé aux professionnels de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const { slug } = await params;

    const cond = session.role === "admin" ? "slug = $1" : "slug = $1 AND status = 'published'";
    const result = await pool.query(`SELECT * FROM exam_library WHERE ${cond}`, [slug]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    const e = result.rows[0];

    const fav = await pool.query(
      `SELECT 1 FROM exam_favorites WHERE user_id = $1 AND exam_id = $2`,
      [session.id, e.id],
    );

    /* Historique personnel — jamais bloquant */
    try {
      await pool.query(
        `INSERT INTO exam_history (user_id, exam_id) VALUES ($1, $2)`,
        [session.id, e.id],
      );
    } catch (he) {
      console.error("[examens] historique:", he);
    }

    return NextResponse.json({
      exam: {
        id: e.id,
        slug: e.slug,
        name: e.name,
        category: e.category,
        status: e.status,
        definition: e.definition,
        objective: e.objective,
        indications: e.indications,
        contraindications: e.contraindications,
        preparation: e.preparation,
        procedureText: e.procedure_text,
        materials: e.materials,
        parameters: e.parameters,
        referenceValues: e.reference_values,
        interpretation: e.interpretation,
        anomalies: e.anomalies,
        limitations: e.limitations,
        references: e.references_text,
        updatedOn: e.updated_on,
      },
      isFavorite: fav.rows.length > 0,
    });
  } catch (error) {
    console.error("Get exam error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PUT — modification d'une fiche (administrateur uniquement, traçabilité de date). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
    }

    await ensureMigrated();
    const { slug } = await params;
    const body = await request.json();

    const r = await pool.query(
      `UPDATE exam_library SET
         name = COALESCE($2, name),
         category = COALESCE($3, category),
         status = COALESCE($4, status),
         definition = COALESCE($5, definition),
         objective = COALESCE($6, objective),
         indications = COALESCE($7, indications),
         contraindications = COALESCE($8, contraindications),
         preparation = COALESCE($9, preparation),
         procedure_text = COALESCE($10, procedure_text),
         materials = COALESCE($11, materials),
         parameters = COALESCE($12, parameters),
         reference_values = COALESCE($13, reference_values),
         interpretation = COALESCE($14, interpretation),
         anomalies = COALESCE($15, anomalies),
         limitations = COALESCE($16, limitations),
         references_text = COALESCE($17, references_text),
         updated_on = COALESCE($18::date, CURRENT_DATE),
         updated_at = now()
       WHERE slug = $1
       RETURNING id`,
      [
        slug,
        body.name ?? null,
        body.category ?? null,
        body.status === "draft" || body.status === "published" ? body.status : null,
        body.definition ?? null,
        body.objective ?? null,
        body.indications ?? null,
        body.contraindications ?? null,
        body.preparation ?? null,
        body.procedureText ?? null,
        body.materials ?? null,
        body.parameters ?? null,
        body.referenceValues ?? null,
        body.interpretation ?? null,
        body.anomalies ?? null,
        body.limitations ?? null,
        body.references ?? null,
        body.updatedOn || null,
      ],
    );

    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update exam error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
