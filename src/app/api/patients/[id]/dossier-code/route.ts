import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, PRESCRIBER_ROLES, hasRole } from "@/lib/audit";

/**
 * POST /api/patients/[id]/dossier-code — RÉINITIALISATION par le médecin/admin.
 * Le code oublié du patient est effacé (jamais lisible — c'est le principe) :
 * le patient en créera un nouveau à sa prochaine connexion.
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
      return NextResponse.json({ error: "Réservé au médecin et à l'administrateur" }, { status: 403 });
    }

    await ensureMigrated();
    const { id } = await params;
    const facilityId = session.facilityId || 1;

    const r = await pool.query(`SELECT facility_id FROM patients WHERE id = $1`, [parseInt(id)]);
    if (r.rows.length === 0 || r.rows[0].facility_id !== facilityId) {
      return NextResponse.json({ error: "Patient introuvable" }, { status: 404 });
    }

    await pool.query(
      `UPDATE patients SET dossier_code_hash = NULL, dossier_code_set_at = NULL,
         dossier_fails = 0, dossier_locked_until = NULL
       WHERE id = $1`,
      [parseInt(id)],
    );

    await audit(session, {
      action: "modifier",
      entity: "patient",
      entityId: parseInt(id),
      patientId: parseInt(id),
      detail: `${session.fullName} a RÉINITIALISÉ le code dossier du patient #${id} (le patient en recréera un nouveau)`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset dossier code error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
