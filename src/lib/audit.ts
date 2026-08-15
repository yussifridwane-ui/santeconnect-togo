import { pool } from "@/db";
import { ensureMigrated } from "@/db/migrate";
import type { UserSession } from "@/lib/auth";

/**
 * Journal de sécurité SantéOnline.
 * Écriture en AJOUT UNIQUEMENT : aucune route API ne permet de modifier
 * ou supprimer ces lignes. "Dr X a consulté le dossier du patient Y
 * le 15/08/2026 à 10:35" — traçabilité garantie.
 */
export async function audit(
  session: UserSession,
  entry: {
    action: "connexion" | "consulter" | "creer" | "modifier" | "supprimer" | "valider" | "imprimer" | "telecharger" | "refus";
    entity: "patient" | "rendez_vous" | "dossier" | "consultation" | "ordonnance" | "labo" | "imagerie" | "pharmacie" | "facture" | "document" | "utilisateur" | "assurance" | "parametre";
    entityId?: number | null;
    patientId?: number | null;
    detail?: string;
  },
): Promise<void> {
  try {
    await ensureMigrated();
    await pool.query(
      `INSERT INTO audit_log (user_id, user_name, user_role, facility_id, patient_id, action, entity, entity_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        session.id,
        session.fullName,
        session.role,
        session.facilityId ?? null,
        entry.patientId ?? null,
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        entry.detail ?? null,
      ],
    );
  } catch (e) {
    // Le journal ne doit jamais faire échouer l'action métier
    console.error("[audit]", e);
  }
}

/* Groupes de rôles — le contrôle d'accès est TOUJOURS côté serveur */
export const STAFF_ROLES = ["admin", "doctor", "nurse", "secretary"];
export const MEDICAL_ROLES = ["admin", "doctor", "nurse"];
export const PRESCRIBER_ROLES = ["admin", "doctor"];
export const LAB_ROLES = ["admin", "lab"];
export const PHARMACY_ROLES = ["admin", "pharmacist"];
export const ADMIN_ROLES = ["admin"];

export function hasRole(session: UserSession, roles: string[]): boolean {
  return roles.includes(session.role);
}
