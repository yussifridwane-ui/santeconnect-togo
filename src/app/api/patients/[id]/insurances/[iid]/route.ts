import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";
import { audit, STAFF_ROLES, hasRole } from "@/lib/audit";

/* ════════════════════════════════════════════════════════════════════
   🛡️ V2.9 — UNE assurance précise d'un patient
   PUT    : modifier les champs · setPrimary · marquer « vérifiée »
   DELETE : supprimer la couverture (la photo carte liée part avec)
   ════════════════════════════════════════════════════════════════════ */

const STATUS_OK = new Set(["actif", "expire", "suspendu", "inconnu"]);

/* Charge la ligne ET vérifie la chaîne de propriété :
   session personnel → patient de SON établissement → assurance de CE patient */
async function loadOwned(session: { facilityId: number | null }, pid: number, iid: number) {
  const r = await pool.query(
    `SELECT pi.*, p.facility_id AS patient_facility
     FROM patient_insurances pi
     JOIN patients p ON p.id = pi.patient_id
     WHERE pi.id = $1 AND pi.patient_id = $2`,
    [iid, pid],
  );
  if (r.rows.length === 0) return { row: null as null | Record<string, unknown>, status: 404, error: "Assurance introuvable" };
  const facilityId = session.facilityId || 1;
  if (r.rows[0].patient_facility !== facilityId) {
    return { row: null, status: 403, error: "Ce patient appartient à un autre établissement" };
  }
  return { row: r.rows[0], status: 200 as number, error: "" };
}

/* Re-promouvoir la plus ancienne autre assurance si la primaire disparaît */
async function ensureOnePrimary(pid: number) {
  await pool.query(
    `UPDATE patient_insurances SET is_primary = true, updated_at = now()
     WHERE id = (
       SELECT id FROM patient_insurances
       WHERE patient_id = $1
       ORDER BY created_at ASC LIMIT 1
     )
     AND NOT EXISTS (
       SELECT 1 FROM patient_insurances WHERE patient_id = $1 AND is_primary = true
     )`,
    [pid],
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; iid: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!hasRole(session, STAFF_ROLES)) {
      return NextResponse.json({ error: "Accès réservé au personnel de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const { id, iid } = await params;
    const pid = parseInt(id);
    const insuranceId = parseInt(iid);
    if (isNaN(pid) || isNaN(insuranceId)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    const owned = await loadOwned(session, pid, insuranceId);
    if (!owned.row) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const body = await request.json();

    /* Action dédiée : marquer la carte VÉRIFIÉE (contrôle manuel par le personnel) */
    if (body.verify === true) {
      await pool.query(
        `UPDATE patient_insurances SET verified_at = now(), updated_at = now() WHERE id = $1`,
        [insuranceId],
      );
      await audit(session, {
        action: "valider",
        entity: "assurance",
        entityId: insuranceId,
        patientId: pid,
        detail: `Carte d'assurance vérifiée manuellement par ${session.fullName}`,
      });
      return NextResponse.json({ success: true });
    }

    const insurerId = body.insurerId ? parseInt(String(body.insurerId)) : null;
    const insurerNameOther = String(body.insurerNameOther || "").trim().slice(0, 120) || null;
    const insuranceNumber = String(body.insuranceNumber || "").trim().slice(0, 60);
    const status = STATUS_OK.has(String(body.status)) ? String(body.status) : "inconnu";
    const notes = String(body.notes || "").trim().slice(0, 1000) || null;
    const cardDocumentId = body.cardDocumentId ? parseInt(String(body.cardDocumentId)) : null;
    /* ▦ V3.1 — QR re-scanné → remplace ; sinon on conserve l'existant */
    const qrPayload = String(body.qrPayload || "").trim().slice(0, 2000) || null;

    if (!insuranceNumber) {
      return NextResponse.json({ error: "Le numéro d'assuré est obligatoire" }, { status: 400 });
    }
    if (!insurerId && !insurerNameOther) {
      return NextResponse.json({ error: "Choisis l'assureur (ou saisis le nom de la mutuelle)" }, { status: 400 });
    }
    if (insurerId) {
      const ins = await pool.query(`SELECT id FROM insurers WHERE id = $1`, [insurerId]);
      if (ins.rows.length === 0) {
        return NextResponse.json({ error: "Assureur inconnu" }, { status: 400 });
      }
    }
    if (cardDocumentId) {
      const doc = await pool.query(
        `SELECT id FROM documents WHERE id = $1 AND patient_id = $2`,
        [cardDocumentId, pid],
      );
      if (doc.rows.length === 0) {
        return NextResponse.json({ error: "Photo de carte introuvable pour ce patient" }, { status: 400 });
      }
    }

    /* Pas de nouvelle photo fournie → on conserve l'existante */
    const newCardId = cardDocumentId || (owned.row.card_document_id as number | null);

    await pool.query(
      `UPDATE patient_insurances
       SET insurer_id = $1, insurer_name_other = $2, insurance_number = $3,
           status = $4, notes = $5, card_document_id = $6,
           qr_payload = COALESCE($8, qr_payload), updated_at = now()
       WHERE id = $7`,
      [insurerId, insurerId ? null : insurerNameOther, insuranceNumber, status, notes, newCardId, insuranceId, qrPayload],
    );

    /* Case « primaire » dans le formulaire (ou bouton dédié) : une seule primaire */
    let becamePrimary = false;
    if (body.isPrimary === true || body.setPrimary === true) {
      await pool.query(
        `UPDATE patient_insurances SET is_primary = false, updated_at = now()
         WHERE patient_id = $1 AND is_primary = true AND id <> $2`,
        [pid, insuranceId],
      );
      await pool.query(
        `UPDATE patient_insurances SET is_primary = true, updated_at = now() WHERE id = $1`,
        [insuranceId],
      );
      becamePrimary = true;
    }

    await audit(session, {
      action: "modifier",
      entity: "assurance",
      entityId: insuranceId,
      patientId: pid,
      detail: `Assurance N° •••${insuranceNumber.slice(-4)} modifiée${becamePrimary ? " — définie primaire" : ""}`,
    });

    return NextResponse.json({ success: true, isPrimary: becamePrimary || !!owned.row.is_primary });
  } catch (error) {
    console.error("Update patient insurance error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; iid: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!hasRole(session, STAFF_ROLES)) {
      return NextResponse.json({ error: "Accès réservé au personnel de santé" }, { status: 403 });
    }

    await ensureMigrated();
    const { id, iid } = await params;
    const pid = parseInt(id);
    const insuranceId = parseInt(iid);
    if (isNaN(pid) || isNaN(insuranceId)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    const owned = await loadOwned(session, pid, insuranceId);
    if (!owned.row) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const wasPrimary = !!owned.row.is_primary;
    const cardDocId = (owned.row.card_document_id as number | null) || null;
    const masked = `•••${String(owned.row.insurance_number || "").slice(-4)}`;

    await pool.query(`DELETE FROM patient_insurances WHERE id = $1`, [insuranceId]);

    /* La photo de carte liée part avec sa ligne (nettoyage propre, aucune fiche
       patient ni document MÉDICAL n'est touché — uniquement la carte assurance) */
    if (cardDocId) {
      await pool.query(
        `DELETE FROM documents WHERE id = $1 AND patient_id = $2 AND kind = 'carte_assurance'`,
        [cardDocId, pid],
      );
    }

    /* Si la primaire part, la plus ancienne restante prend le relais */
    if (wasPrimary) await ensureOnePrimary(pid);

    await audit(session, {
      action: "supprimer",
      entity: "assurance",
      entityId: insuranceId,
      patientId: pid,
      detail: `Assurance N° ${masked} supprimée de la fiche patient`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete patient insurance error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
