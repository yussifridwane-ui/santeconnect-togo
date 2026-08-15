import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/**
 * GET /api/audit — journal de sécurité (LECTURE SEULE, administrateurs uniquement).
 * Aucune route PUT/PATCH/DELETE n'existe ici : le journal est inaltérable.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
    }

    await ensureMigrated();
    const facilityId = session.facilityId || 1;
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

    const result = q
      ? await pool.query(
          `SELECT id, user_id, user_name, user_role, patient_id, action, entity, entity_id, detail, created_at
           FROM audit_log
           WHERE facility_id = $1 AND (user_name ILIKE $2 OR detail ILIKE $2 OR entity ILIKE $2)
           ORDER BY created_at DESC LIMIT $3`,
          [facilityId, `%${q}%`, limit],
        )
      : await pool.query(
          `SELECT id, user_id, user_name, user_role, patient_id, action, entity, entity_id, detail, created_at
           FROM audit_log
           WHERE facility_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [facilityId, limit],
        );

    return NextResponse.json({ entries: result.rows });
  } catch (error) {
    console.error("Get audit error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
