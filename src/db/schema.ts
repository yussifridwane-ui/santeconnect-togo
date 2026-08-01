import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "doctor", "nurse", "secretary", "patient"]);
export const facilityTypeEnum = pgEnum("facility_type", ["clinic", "laboratory", "hospital"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "completed", "cancelled", "no_show"]);
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
