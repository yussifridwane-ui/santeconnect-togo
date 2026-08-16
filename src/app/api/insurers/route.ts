import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/**
 * 🛡️ ASSUREURS MALADIE (V2.7 — Module Assurances)
 * GET  → liste des assureurs (+ taux de prise en charge) — tout le personnel
 * POST → nouvel assureur { name, rate } — admin seulement
 * PUT  → modifier un assureur { id, name?, rate? } — admin seulement
 * Rate = % pris en charge par l'assureur (80 → patient ne paie que 20 %).
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    await ensureMigrated();
    const rows = await pool.query(
      `SELECT id, name, rate, phone FROM insurers ORDER BY id ASC`,
    );
    return NextResponse.json({ items: rows.rows });
  } catch (e) {
    console.error("insurers GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
    }
    await ensureMigrated();

    const body = await request.json();
    const name = String(body.name || "").trim().slice(0, 120);
    const rate = Math.min(100, Math.max(0, parseInt(body.rate) || 80));
    const phone = body.phone ? String(body.phone).slice(0, 30) : null;
    if (!name) {
      return NextResponse.json({ error: "Nom de l'assureur obligatoire." }, { status: 400 });
    }
    const ins = await pool.query(
      `INSERT INTO insurers (name, rate, phone) VALUES ($1,$2,$3)
       ON CONFLICT (name) DO UPDATE SET rate = $2 RETURNING id`,
      [name, rate, phone],
    );
    return NextResponse.json({ ok: true, id: ins.rows[0]?.id }, { status: 201 });
  } catch (e) {
    console.error("insurers POST:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
    }
    await ensureMigrated();

    const body = await request.json();
    const id = parseInt(body.id);
    if (!id) return NextResponse.json({ error: "Assureur inconnu." }, { status: 400 });
    const rate = body.rate !== undefined ? Math.min(100, Math.max(0, parseInt(body.rate) || 0)) : null;
    const name = body.name ? String(body.name).trim().slice(0, 120) : null;
    const phone = body.phone !== undefined ? String(body.phone || "").slice(0, 30) : null;

    if (rate !== null) await pool.query(`UPDATE insurers SET rate = $1 WHERE id = $2`, [rate, id]);
    if (name) await pool.query(`UPDATE insurers SET name = $1 WHERE id = $2`, [name, id]);
    if (phone !== null) await pool.query(`UPDATE insurers SET phone = $1 WHERE id = $2`, [phone, id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("insurers PUT:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
