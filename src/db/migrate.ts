import { pool } from "@/db";

/**
 * Migrations idempotentes SantéOnline — 100 % ADDITIVES.
 * Règle d'or : jamais de DROP, jamais de suppression, jamais de renommage.
 * Chaque ordre SQL utilise IF NOT EXISTS → rejouable à l'infini sans risque.
 * Les données existantes ne sont jamais modifiées.
 */
const STATEMENTS: string[] = [
  /* ---------- Rôles : pharmacien + laboratoire (ajout de valeurs d'enum) ---------- */
  `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pharmacist'`,
  `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lab'`,
  /* ---------- Statuts de rendez-vous : « reporté » ---------- */
  `ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'rescheduled'`,

  /* ---------- Fiche patient complète : nouvelles colonnes (toutes facultatives) ---------- */
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS record_number varchar(40)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS usage_name varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS place_of_birth varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality varchar(120) DEFAULT 'Togolaise'`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS id_type varchar(60)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS id_number varchar(80)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS photo_url varchar(500)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_secondary varchar(50)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp varchar(50)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS country varchar(120) DEFAULT 'Togo'`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS region varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS city varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS commune varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS quartier varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS street varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS house_number varchar(40)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS landmark varchar(255)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_full text`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status varchar(40)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS spouse_name varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS spouse_phone varchar(50)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS children_count integer`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_name varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_relation varchar(80)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_phone_secondary varchar(50)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_whatsapp varchar(50)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_address varchar(255)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_city varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS profession varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS employer varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS work_phone varchar(50)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS work_email varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS work_address varchar(255)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS work_city varchar(120)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurer_name varchar(160)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS insured_number varchar(100)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_card_number varchar(100)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS coverage_type varchar(60)`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS coverage_start date`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS coverage_end date`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS coverage_status varchar(40) DEFAULT 'inconnue'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_record_number ON patients(record_number) WHERE record_number IS NOT NULL`,

  /* ---------- PIN personnel (V2.5) : colonne prête, jamais remplie en clair ---------- */
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash varchar(255)`,

  /* ---------- Consultations (constantes + diagnostic + traitement) ---------- */
  `CREATE TABLE IF NOT EXISTS consultations (
    id serial PRIMARY KEY,
    patient_id integer NOT NULL,
    doctor_id integer,
    facility_id integer,
    appointment_id integer,
    motif varchar(255),
    symptoms text,
    temperature numeric(4,1),
    blood_pressure varchar(20),
    pulse integer,
    weight numeric(5,1),
    height numeric(5,1),
    saturation numeric(4,1),
    observations text,
    diagnosis text,
    treatment text,
    prescription text,
    exams_requested text,
    recommendations text,
    next_appointment_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Ordonnances structurées ---------- */
  `CREATE TABLE IF NOT EXISTS prescriptions (
    id serial PRIMARY KEY,
    consultation_id integer,
    patient_id integer NOT NULL,
    doctor_id integer,
    facility_id integer,
    instructions text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS prescription_items (
    id serial PRIMARY KEY,
    prescription_id integer NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication varchar(255) NOT NULL,
    dosage varchar(120),
    posology varchar(255),
    frequency varchar(120),
    duration varchar(120),
    instructions varchar(255)
  )`,

  /* ---------- Laboratoire ---------- */
  `CREATE TABLE IF NOT EXISTS lab_requests (
    id serial PRIMARY KEY,
    patient_id integer NOT NULL,
    doctor_id integer,
    facility_id integer,
    exam_type varchar(255) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'requested',
    result text,
    comment text,
    validated_by integer,
    created_at timestamp NOT NULL DEFAULT now(),
    validated_at timestamp,
    updated_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Imagerie médicale ---------- */
  `CREATE TABLE IF NOT EXISTS imaging_exams (
    id serial PRIMARY KEY,
    patient_id integer NOT NULL,
    doctor_id integer,
    facility_id integer,
    exam_type varchar(60) NOT NULL DEFAULT 'autre',
    request_note text,
    status varchar(20) NOT NULL DEFAULT 'requested',
    report text,
    document_id integer,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Pharmacie (stock, lots, expirations, fournisseurs) ---------- */
  `CREATE TABLE IF NOT EXISTS pharmacy_medications (
    id serial PRIMARY KEY,
    facility_id integer NOT NULL,
    name varchar(255) NOT NULL,
    form varchar(60),
    dosage varchar(60),
    stock integer NOT NULL DEFAULT 0,
    low_stock integer NOT NULL DEFAULT 5,
    lot varchar(80),
    expiry_date date,
    supplier varchar(160),
    price_fcfa integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pharmacy_movements (
    id serial PRIMARY KEY,
    medication_id integer NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
    facility_id integer NOT NULL,
    kind varchar(10) NOT NULL,
    qty integer NOT NULL,
    note varchar(255),
    created_by integer,
    created_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Facturation patients ---------- */
  `CREATE TABLE IF NOT EXISTS invoices (
    id serial PRIMARY KEY,
    patient_id integer,
    facility_id integer NOT NULL,
    number varchar(40),
    discount_fcfa integer NOT NULL DEFAULT 0,
    total_fcfa integer NOT NULL DEFAULT 0,
    paid_fcfa integer NOT NULL DEFAULT 0,
    method varchar(30),
    status varchar(20) NOT NULL DEFAULT 'unpaid',
    notes text,
    created_by integer,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS invoice_items (
    id serial PRIMARY KEY,
    invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    kind varchar(30) NOT NULL DEFAULT 'service',
    label varchar(255) NOT NULL,
    qty integer NOT NULL DEFAULT 1,
    unit_price_fcfa integer NOT NULL DEFAULT 0,
    total_fcfa integer NOT NULL DEFAULT 0
  )`,

  /* ---------- Notifications internes ---------- */
  `CREATE TABLE IF NOT EXISTS notifications (
    id serial PRIMARY KEY,
    user_id integer NOT NULL,
    facility_id integer,
    type varchar(40) NOT NULL DEFAULT 'info',
    title varchar(255) NOT NULL,
    body text,
    link varchar(255),
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Documents patients ---------- */
  `CREATE TABLE IF NOT EXISTS documents (
    id serial PRIMARY KEY,
    patient_id integer NOT NULL,
    uploaded_by integer,
    facility_id integer,
    kind varchar(40) NOT NULL DEFAULT 'autre',
    title varchar(255) NOT NULL,
    mime varchar(80),
    url text,
    data text,
    size_bytes integer,
    created_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Journal de sécurité (append-only : JAMAIS modifié par les utilisateurs) ---------- */
  `CREATE TABLE IF NOT EXISTS audit_log (
    id serial PRIMARY KEY,
    user_id integer,
    user_name varchar(255),
    user_role varchar(30),
    facility_id integer,
    patient_id integer,
    action varchar(40) NOT NULL,
    entity varchar(40) NOT NULL,
    entity_id integer,
    detail text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,

  /* ---------- Index de performance ---------- */
  `CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_patient ON lab_requests(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_imaging_patient ON imaging_exams(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_facility ON invoices(facility_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_facility ON audit_log(facility_id, created_at DESC)`,
];

let migrating: Promise<void> | null = null;

/** Exécute les migrations une seule fois par processus (idempotent, sans risque). */
export function ensureMigrated(): Promise<void> {
  if (!migrating) {
    migrating = (async () => {
      for (const stmt of STATEMENTS) {
        try {
          await pool.query(stmt);
        } catch (e) {
          // On n'interrompt JAMAIS le démarrage : on journalise et on poursuit
          console.error("[migrate] étape ignorée:", (e as Error).message, "→", stmt.slice(0, 80));
        }
      }
      console.log("[migrate] ✅ schéma SantéOnline v2 prêt");
    })().catch((e) => {
      console.error("[migrate] échec global (non bloquant):", e);
    });
  }
  return migrating;
}
