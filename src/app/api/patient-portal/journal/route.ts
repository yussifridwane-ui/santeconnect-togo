import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/**
 * JOURNAL DE SANTÉ QUOTIDIEN — écrit par le patient lui-même (1 entrée/jour).
 * GET : ses 30 dernières entrées. POST : consigne (ou met à jour) l'entrée du jour.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "patient") return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });

    await ensureMigrated();
    const me = await pool.query(`SELECT id FROM patients WHERE user_id = $1`, [session.id]);
    if (me.rows.length === 0) return NextResponse.json({ entries: [] });

    const r = await pool.query(
      `SELECT id, entry_date, mood, symptoms, note, created_at
       FROM patient_journal WHERE patient_id = $1 ORDER BY entry_date DESC LIMIT 30`,
      [me.rows[0].id],
    );
    return NextResponse.json({ entries: r.rows });
  } catch (error) {
    console.error("Journal get error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "patient") return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });

    await ensureMigrated();
    const me = await pool.query(`SELECT id FROM patients WHERE user_id = $1`, [session.id]);
    if (me.rows.length === 0) {
      return NextResponse.json({ error: "Aucun dossier lié à ton compte" }, { status: 404 });
    }

    const body = await request.json();
    const mood = parseInt(String(body.mood || ""));
    const symptoms = String(body.symptoms || "").trim() || null;
    const note = String(body.note || "").trim() || null;
    if (!note && !symptoms) {
      return NextResponse.json({ error: "Écris au moins une note ou un symptôme" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO patient_journal (patient_id, entry_date, mood, symptoms, note)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (patient_id, entry_date)
       DO UPDATE SET mood = $2, symptoms = $3, note = $4`,
      [me.rows[0].id, Number.isFinite(mood) && mood >= 1 && mood <= 5 ? mood : null, symptoms, note],
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Journal post error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
