import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, PRESCRIBER_ROLES, hasRole } from "@/lib/audit";

interface OrdoItem {
  medication?: string;
  dosage?: string;
  posology?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

/**
 * POST /api/patients/[id]/ordonnances — ordonnance structurée :
 * lignes (médicament / dosage / posologie / fréquence / durée / instructions)
 * + instructions générales. Imprimable côté interface avec l'en-tête
 * professionnelle de l'établissement. Réservé au médecin / administrateur.
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
    if (!hasRole(session, PRESCRIBER_ROLES)) {
      return NextResponse.json({ error: "Seul le médecin peut rédiger une ordonnance" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const pid = parseInt(id);
    const facilityId = session.facilityId || 1;
    const body = await request.json();
    const items: OrdoItem[] = Array.isArray(body.items) ? body.items : [];
    const clean = items.filter((i) => i && String(i.medication || "").trim());

    if (clean.length === 0) {
      return NextResponse.json({ error: "L'ordonnance doit contenir au moins un médicament" }, { status: 400 });
    }

    const check = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [pid]);
    if (check.rows.length === 0 || check.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    const ord = await pool.query(
      `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, facility_id, instructions)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [
        body.consultationId ? parseInt(String(body.consultationId)) : null,
        pid,
        session.id,
        facilityId,
        String(body.instructions || "").trim() || null,
      ],
    );
    const ordId = ord.rows[0].id;

    for (const i of clean) {
      await pool.query(
        `INSERT INTO prescription_items (prescription_id, medication, dosage, posology, frequency, duration, instructions)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          ordId,
          String(i.medication).slice(0, 255),
          i.dosage ? String(i.dosage).slice(0, 120) : null,
          i.posology ? String(i.posology).slice(0, 255) : null,
          i.frequency ? String(i.frequency).slice(0, 120) : null,
          i.duration ? String(i.duration).slice(0, 120) : null,
          i.instructions ? String(i.instructions).slice(0, 255) : null,
        ],
      );
    }

    await audit(session, {
      action: "creer",
      entity: "ordonnance",
      entityId: ordId,
      patientId: pid,
      detail: `Ordonnance #${ordId} (${clean.length} médicament${clean.length > 1 ? "s" : ""}) rédigée par ${session.fullName} — patient #${pid}`,
    });

    return NextResponse.json({ success: true, ordonnanceId: ordId }, { status: 201 });
  } catch (error) {
    console.error("Create ordonnance error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
