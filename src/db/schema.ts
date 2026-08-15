import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "doctor", "nurse", "secretary", "patient", "pharmacist", "lab"]);
export const facilityTypeEnum = pgEnum("facility_type", ["clinic", "laboratory", "hospital"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "completed", "cancelled", "no_show", "rescheduled"]);
export const messageStatusEnum = pgEnum("message_status", ["unread", "read", "archived"]);
export const appointmentTypeEnum = pgEnum("appointment_type", ["consultation", "lab_test", "follow_up", "emergency", "specialist"]);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  role: userRoleEnum("role").notNull().default("patient"),
  facilityId: integer("facility_id"),
  avatar: varchar("avatar", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Facilities (Clinics, Laboratories, Hospitals)
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: facilityTypeEnum("type").notNull(),
  description: text("description"),
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  logo: varchar("logo", { length: 255 }),
  capacity: integer("capacity"),
  operatingHours: varchar("operating_hours", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Patients
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  facilityId: integer("facility_id"), // Linked cabinet
  dateOfBirth: timestamp("date_of_birth").notNull(),
  gender: varchar("gender", { length: 10 }),
  bloodType: varchar("blood_type", { length: 5 }),
  address: varchar("address", { length: 500 }),
  emergencyContact: varchar("emergency_contact", { length: 50 }),
  emergencyPhone: varchar("emergency_phone", { length: 50 }),
  insuranceNumber: varchar("insurance_number", { length: 100 }),
  medicalNotes: text("medical_notes"),
  // 🔑 Code dossier patient (V2.2, style T-Money) — haché bcrypt, JAMAIS en clair
  dossierCodeHash: varchar("dossier_code_hash", { length: 255 }),
  dossierCodeSetAt: timestamp("dossier_code_set_at"),
  dossierFails: integer("dossier_fails").notNull().default(0),
  dossierLockedUntil: timestamp("dossier_locked_until"),
  /* ===== Fiche patient complète — SantéOnline v2 (toutes colonnes facultatives) ===== */
  recordNumber: varchar("record_number", { length: 40 }), // N° dossier unique (DOS-…)
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  usageName: varchar("usage_name", { length: 120 }),
  placeOfBirth: varchar("place_of_birth", { length: 160 }),
  nationality: varchar("nationality", { length: 120 }).default("Togolaise"),
  idType: varchar("id_type", { length: 60 }),
  idNumber: varchar("id_number", { length: 80 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  phoneSecondary: varchar("phone_secondary", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  country: varchar("country", { length: 120 }).default("Togo"),
  region: varchar("region", { length: 120 }),
  city: varchar("city", { length: 120 }),
  commune: varchar("commune", { length: 120 }),
  quartier: varchar("quartier", { length: 160 }),
  street: varchar("street", { length: 160 }),
  houseNumber: varchar("house_number", { length: 40 }),
  landmark: varchar("landmark", { length: 255 }),
  addressFull: text("address_full"),
  maritalStatus: varchar("marital_status", { length: 40 }),
  spouseName: varchar("spouse_name", { length: 160 }),
  spousePhone: varchar("spouse_phone", { length: 50 }),
  childrenCount: integer("children_count"),
  emergencyName: varchar("emergency_name", { length: 160 }),
  emergencyRelation: varchar("emergency_relation", { length: 80 }),
  emergencyPhoneSecondary: varchar("emergency_phone_secondary", { length: 50 }),
  emergencyWhatsapp: varchar("emergency_whatsapp", { length: 50 }),
  emergencyAddress: varchar("emergency_address", { length: 255 }),
  emergencyCity: varchar("emergency_city", { length: 120 }),
  profession: varchar("profession", { length: 120 }),
  employer: varchar("employer", { length: 160 }),
  workPhone: varchar("work_phone", { length: 50 }),
  workEmail: varchar("work_email", { length: 160 }),
  workAddress: varchar("work_address", { length: 255 }),
  workCity: varchar("work_city", { length: 120 }),
  insurerName: varchar("insurer_name", { length: 160 }),
  insuredNumber: varchar("insured_number", { length: 100 }),
  insuranceCardNumber: varchar("insurance_card_number", { length: 100 }),
  coverageType: varchar("coverage_type", { length: 60 }),
  coverageStart: timestamp("coverage_start", { mode: "string" }),
  coverageEnd: timestamp("coverage_end", { mode: "string" }),
  coverageStatus: varchar("coverage_status", { length: 40 }).default("inconnue"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  facilityId: integer("facility_id").notNull(),
  doctorId: integer("doctor_id"),
  title: varchar("title", { length: 255 }).notNull(),
  type: appointmentTypeEnum("type").notNull(),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  isAutoScheduled: boolean("is_auto_scheduled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  facilityId: integer("facility_id"),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  status: messageStatusEnum("status").notNull().default("unread"),
  isSystemMessage: boolean("is_system_message").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Departments
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  headDoctorId: integer("head_doctor_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subscriptions (SaaS billing per cabinet)
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "blocked",
  "cancelled",
]);

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull().unique(),
  planId: varchar("plan_id", { length: 20 }).notNull().default("pro"),
  billingCycle: varchar("billing_cycle", { length: 10 }).notNull().default("monthly"),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payments (Mobile Money via CinetPay: Flooz / T-Money)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull(),
  subscriptionId: integer("subscription_id"),
  planId: varchar("plan_id", { length: 20 }).notNull(),
  billingCycle: varchar("billing_cycle", { length: 10 }).notNull().default("monthly"),
  amountFcfa: integer("amount_fcfa").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
  method: varchar("method", { length: 20 }),
  provider: varchar("provider", { length: 20 }).notNull().default("cinetpay"),
  providerTxId: varchar("provider_tx_id", { length: 120 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

// Automation rules (auto-approve payments, payouts guardrails)
export const automationRules = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull().unique(),
  autoApprovePayments: boolean("auto_approve_payments").notNull().default(true),
  maxPerTransactionFcfa: integer("max_per_transaction_fcfa").notNull().default(100000),
  maxPerDayFcfa: integer("max_per_day_fcfa").notNull().default(300000),
  cancelWindowMinutes: integer("cancel_window_minutes").notNull().default(60),
  allowedPayoutRecipients: text("allowed_payout_recipients").notNull().default("[]"),
  autoPayoutsEnabled: boolean("auto_payouts_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Automation audit log (every automatic decision, reversible within window)
export const automationLog = pgTable("automation_log", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull(),
  kind: varchar("kind", { length: 30 }).notNull(),
  reference: varchar("reference", { length: 120 }).notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  counterparty: varchar("counterparty", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("auto_approved"),
  decision: varchar("decision", { length: 20 }).notNull().default("auto"),
  reason: text("reason"),
  relatedPaymentId: integer("related_payment_id"),
  notifyWaLink: text("notify_wa_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reversedAt: timestamp("reversed_at"),
});

// ============ SikaStock : SaaS de gestion de commerce ============
export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  city: varchar("city", { length: 100 }),
  address: varchar("address", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sikaProducts = pgTable("sika_products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  priceFcfa: integer("price_fcfa").notNull(),
  costFcfa: integer("cost_fcfa").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  lowStock: integer("low_stock").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sikaCustomers = pgTable("sika_customers", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sikaSales = pgTable("sika_sales", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  customerId: integer("customer_id"),
  totalFcfa: integer("total_fcfa").notNull(),
  method: varchar("method", { length: 20 }).notNull().default("cash"),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  waLink: text("wa_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sikaSaleItems = pgTable("sika_sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id"),
  name: varchar("name", { length: 255 }),
  qty: integer("qty").notNull(),
  unitPriceFcfa: integer("unit_price_fcfa").notNull(),
});

export const sikaSubscriptions = pgTable("sika_subscriptions", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().unique(),
  plan: varchar("plan", { length: 20 }).notNull().default("pro"),
  status: varchar("status", { length: 20 }).notNull().default("trialing"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Medical Records
export const medicalRecords = pgTable("medical_records", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id"),
  facilityId: integer("facility_id"),
  title: varchar("title", { length: 255 }).notNull(),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  notes: text("notes"),
  recordType: varchar("record_type", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============ SantéOnline v2 — nouvelles tables (100 % additives) ============

// Consultations (constantes + diagnostic + traitement)
export const consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id"),
  facilityId: integer("facility_id"),
  appointmentId: integer("appointment_id"),
  motif: varchar("motif", { length: 255 }),
  symptoms: text("symptoms"),
  temperature: numeric("temperature", { precision: 4, scale: 1 }),
  bloodPressure: varchar("blood_pressure", { length: 20 }),
  pulse: integer("pulse"),
  weight: numeric("weight", { precision: 5, scale: 1 }),
  height: numeric("height", { precision: 5, scale: 1 }),
  saturation: numeric("saturation", { precision: 4, scale: 1 }),
  observations: text("observations"),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  prescription: text("prescription"),
  examsRequested: text("exams_requested"),
  recommendations: text("recommendations"),
  nextAppointmentAt: timestamp("next_appointment_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Ordonnances
export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id"),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id"),
  facilityId: integer("facility_id"),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const prescriptionItems = pgTable("prescription_items", {
  id: serial("id").primaryKey(),
  prescriptionId: integer("prescription_id").notNull(),
  medication: varchar("medication", { length: 255 }).notNull(),
  dosage: varchar("dosage", { length: 120 }),
  posology: varchar("posology", { length: 255 }),
  frequency: varchar("frequency", { length: 120 }),
  duration: varchar("duration", { length: 120 }),
  instructions: varchar("instructions", { length: 255 }),
});

// Laboratoire
export const labRequests = pgTable("lab_requests", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id"),
  facilityId: integer("facility_id"),
  examType: varchar("exam_type", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("requested"),
  result: text("result"),
  comment: text("comment"),
  validatedBy: integer("validated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  validatedAt: timestamp("validated_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Imagerie médicale
export const imagingExams = pgTable("imaging_exams", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id"),
  facilityId: integer("facility_id"),
  examType: varchar("exam_type", { length: 60 }).notNull().default("autre"),
  requestNote: text("request_note"),
  status: varchar("status", { length: 20 }).notNull().default("requested"),
  report: text("report"),
  documentId: integer("document_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Pharmacie
export const pharmacyMedications = pgTable("pharmacy_medications", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  form: varchar("form", { length: 60 }),
  dosage: varchar("dosage", { length: 60 }),
  stock: integer("stock").notNull().default(0),
  lowStock: integer("low_stock").notNull().default(5),
  lot: varchar("lot", { length: 80 }),
  expiryDate: timestamp("expiry_date", { mode: "string" }),
  supplier: varchar("supplier", { length: 160 }),
  priceFcfa: integer("price_fcfa").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const pharmacyMovements = pgTable("pharmacy_movements", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull(),
  facilityId: integer("facility_id").notNull(),
  kind: varchar("kind", { length: 10 }).notNull(),
  qty: integer("qty").notNull(),
  note: varchar("note", { length: 255 }),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Facturation patients
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id"),
  facilityId: integer("facility_id").notNull(),
  number: varchar("number", { length: 40 }),
  discountFcfa: integer("discount_fcfa").notNull().default(0),
  totalFcfa: integer("total_fcfa").notNull().default(0),
  paidFcfa: integer("paid_fcfa").notNull().default(0),
  method: varchar("method", { length: 30 }),
  status: varchar("status", { length: 20 }).notNull().default("unpaid"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  kind: varchar("kind", { length: 30 }).notNull().default("service"),
  label: varchar("label", { length: 255 }).notNull(),
  qty: integer("qty").notNull().default(1),
  unitPriceFcfa: integer("unit_price_fcfa").notNull().default(0),
  totalFcfa: integer("total_fcfa").notNull().default(0),
});

// Notifications internes
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  facilityId: integer("facility_id"),
  type: varchar("type", { length: 40 }).notNull().default("info"),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 255 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Documents patients
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  uploadedBy: integer("uploaded_by"),
  facilityId: integer("facility_id"),
  kind: varchar("kind", { length: 40 }).notNull().default("autre"),
  title: varchar("title", { length: 255 }).notNull(),
  mime: varchar("mime", { length: 80 }),
  url: text("url"),
  data: text("data"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Journal de sécurité — append-only, JAMAIS modifiable par les utilisateurs (aucune API d'écriture)
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: varchar("user_name", { length: 255 }),
  userRole: varchar("user_role", { length: 30 }),
  facilityId: integer("facility_id"),
  patientId: integer("patient_id"),
  action: varchar("action", { length: 40 }).notNull(),
  entity: varchar("entity", { length: 40 }).notNull(),
  entityId: integer("entity_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ─────────── Module pédagogique « Examens paracliniques » (bibliothèque globale) ─────────── */
export const examLibrary = pgTable("exam_library", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("published"),
  definition: text("definition"),
  objective: text("objective"),
  indications: text("indications"),
  contraindications: text("contraindications"),
  preparation: text("preparation"),
  procedureText: text("procedure_text"),
  materials: text("materials"),
  parameters: text("parameters"),
  referenceValues: text("reference_values"),
  interpretation: text("interpretation"),
  anomalies: text("anomalies"),
  limitations: text("limitations"),
  referencesText: text("references_text"),
  updatedOn: date("updated_on"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const examFavorites = pgTable(
  "exam_favorites",
  {
    userId: integer("user_id").notNull(),
    examId: integer("exam_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.examId] })]
);

export const examHistory = pgTable("exam_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  examId: integer("exam_id").notNull(),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
});

export const examQuiz = pgTable("exam_quiz", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 40 }).notNull(),
  question: text("question").notNull(),
  options: text("options").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation"),
  examSlug: varchar("exam_slug", { length: 80 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const examCases = pgTable("exam_cases", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  vignette: text("vignette").notNull(),
  question: text("question").notNull(),
  options: text("options").notNull(),
  correctIndex: integer("correct_index").notNull(),
  analysis: text("analysis").notNull(),
  examSlug: varchar("exam_slug", { length: 80 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
