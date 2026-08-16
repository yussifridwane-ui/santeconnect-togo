import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit } from "@/lib/audit";
import { verifyDossierToken } from "@/lib/dossier";

/**
 * GET /api/documents/[id] — téléchargement sécurisé d'un document/rapport médical.
 * Personnel = même établissement. Patient = SON document + jeton dossier (code) valide.
 */
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
    const r = await pool.query(
      `SELECT d.*, p.user_id AS patient_user_id, p.facility_id AS patient_facility_id
       FROM documents d JOIN patients p ON p.id = d.patient_id WHERE d.id = $1`,
      [parseInt(id)],
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }
    const doc = r.rows[0];

    if (session.role === "patient") {
      if (doc.patient_user_id !== session.id) {
        await audit(session, { action: "refus", entity: "document", entityId: doc.id, patientId: doc.patient_id, detail: "Tentative de téléchargement du document d'un autre patient" });
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      const ok = await verifyDossierToken(request, doc.patient_id, session.id);
      if (!ok) {
        return NextResponse.json({ error: "Code du dossier requis", needCode: true }, { status: 403 });
      }
    } else if (doc.patient_facility_id !== (session.facilityId || 1)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await audit(session, {
      action: "telecharger",
      entity: "document",
      entityId: doc.id,
      patientId: doc.patient_id,
      detail: `Document « ${doc.title} » consulté/téléchargé par ${session.fullName}`,
    });

    /* data: URL → binaire */
    const base64 = String(doc.data || "").split(",")[1] || "";
    const bytes = Buffer.from(base64, "base64");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": doc.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.title)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Download document error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
