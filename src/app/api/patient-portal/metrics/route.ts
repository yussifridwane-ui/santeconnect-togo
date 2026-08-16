import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

const METRICS: Record<string, { label: string; unit: string; dual?: boolean }> = {
  poids: { label: "Poids", unit: "kg" },
  glycemie: { label: "Glycémie", unit: "g/L" },
  tension: { label: "Tension artérielle", unit: "mmHg", dual: true },
  temperature: { label: "Température", unit: "°C" },
  pouls: { label: "Pouls", unit: "/min" },
  spo2: { label: "SpO₂", unit: "%" },
  douleur: { label: "Douleur (0-10)", unit: "/10" },
  sommeil: { label: "Sommeil", unit: "h" },
};

/**
 * SUIVI DE SANTÉ — mesures saisies par le patient (source "manuel").
 * Architecture extensible : la colonne `source` accueillera demain les appareils
 * connectés et applications partenaires. GET : historique. POST : nouvelle mesure.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "patient") return NextResponse.json({ error: "Espace réservé aux patients" }, { status: 403 });

    await ensureMigrated();
    const me = await pool.query(`SELECT id FROM patients WHERE user_id = $1`, [session.id]);
    if (me.rows.length === 0) return NextResponse.json({ metrics: [], latest: [] });

    const r = await pool.query(
      `SELECT id, metric, value, value2, unit, taken_at, source
       FROM patient_metrics WHERE patient_id = $1 ORDER BY taken_at DESC LIMIT 80`,
      [me.rows[0].id],
    );
    const latest = await pool.query(
      `SELECT DISTINCT ON (metric) metric, value, value2, unit, taken_at
       FROM patient_metrics WHERE patient_id = $1 ORDER BY metric, taken_at DESC`,
      [me.rows[0].id],
    );
    return NextResponse.json({ metrics: r.rows, latest: latest.rows });
  } catch (error) {
    console.error("Metrics get error:", error);
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
    const metric = String(body.metric || "");
    const cfg = METRICS[metric];
    if (!cfg) return NextResponse.json({ error: "Mesure inconnue" }, { status: 400 });

    const v = parseFloat(String(body.value ?? ""));
    const v2 = cfg.dual ? parseFloat(String(body.value2 ?? "")) : null;
    if (!Number.isFinite(v) || (cfg.dual && !Number.isFinite(v2 as number))) {
      return NextResponse.json({ error: "Valeur de mesure invalide" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO patient_metrics (patient_id, metric, value, value2, unit, source)
       VALUES ($1,$2,$3,$4,$5,'manuel')`,
      [me.rows[0].id, metric, v, v2, cfg.unit],
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Metrics post error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
