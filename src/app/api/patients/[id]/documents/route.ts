import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, STAFF_ROLES, hasRole } from "@/lib/audit";

const MAX_BYTES = 1_800_000; // ~1,8 Mo — scan/photo de rapport (Copie sécurisée en base Neon)

/**
 * POST /api/patients/[id]/documents — déposer un RAPPORT MÉDICAL (scan/photo PDF ou image).
 * Stocké comme document clinique du dossier (mime + base64). GET = liste des métadonnées.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!hasRole(session, STAFF_ROLES) && session.role !== "pharmacist" && session.role !== "lab") {
      return NextResponse.json({ error: "Réservé au personnel" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const kind = String(body.kind || "rapport").slice(0, 40);
    const mime = String(body.mime || "application/octet-stream").slice(0, 80);
    const data = String(body.data || "");

    if (!title) return NextResponse.json({ error: "Titre du document obligatoire" }, { status: 400 });
    if (!data.startsWith("data:")) return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
    const estBytes = Math.round(data.length * 0.75);
    if (estBytes > MAX_BYTES) {
      return NextResponse.json({ error: "Fichier trop lourd (max 1,8 Mo — compresse la photo du rapport)" }, { status: 413 });
    }

    const facilityId = session.facilityId || 1;
    const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
    if (check.rows.length === 0 || check.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    const r = await pool.query(
      `INSERT INTO documents (patient_id, uploaded_by, facility_id, kind, title, mime, data, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [pid, session.id, facilityId, kind, title.slice(0, 255), mime, data, estBytes],
    );

    await audit(session, {
      action: "creer",
      entity: "document",
      entityId: r.rows[0].id,
      patientId: pid,
      detail: `Document « ${title} » (${kind}, ${Math.round(estBytes / 1024)} Ko) déposé par ${session.fullName}`,
    });

    return NextResponse.json({ success: true, documentId: r.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Upload document error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const facilityId = session.facilityId || 1;

    if (session.role === "patient") {
      const me = await pool.query(`SELECT id FROM patients WHERE user_id = $1 AND id = $2`, [session.id, pid]);
      if (me.rows.length === 0) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    } else {
      const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
      if (check.rows.length === 0 || check.rows[0].facility_id !== facilityId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const r = await pool.query(
      `SELECT d.id, d.kind, d.title, d.mime, d.size_bytes, d.created_at, u.full_name AS uploaded_by_name
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.patient_id = $1 ORDER BY d.created_at DESC`,
      [pid],
    );
    return NextResponse.json({ documents: r.rows });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
