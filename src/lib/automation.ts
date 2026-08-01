import { db } from "@/db";
import {
  automationRules,
  automationLog,
  subscriptions,
  payments,
} from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { activateSubscription } from "./billing";

export type Rule = typeof automationRules.$inferSelect;
export type LogEntry = typeof automationLog.$inferSelect;

export async function getRules(facilityId: number): Promise<Rule> {
  const rows = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.facilityId, facilityId))
    .limit(1);
  if (rows[0]) return rows[0];
  const [r] = await db
    .insert(automationRules)
    .values({ facilityId })
    .returning();
  return r;
}

export async function updateRules(facilityId: number, patch: Partial<Rule>) {
  const r = await getRules(facilityId);
  const safe: any = { updatedAt: new Date() };
  if (typeof patch.autoApprovePayments === "boolean")
    safe.autoApprovePayments = patch.autoApprovePayments;
  if (typeof patch.maxPerTransactionFcfa === "number")
    safe.maxPerTransactionFcfa = patch.maxPerTransactionFcfa;
  if (typeof patch.maxPerDayFcfa === "number")
    safe.maxPerDayFcfa = patch.maxPerDayFcfa;
  if (typeof patch.cancelWindowMinutes === "number")
    safe.cancelWindowMinutes = patch.cancelWindowMinutes;
  if (typeof patch.allowedPayoutRecipients === "string")
    safe.allowedPayoutRecipients = patch.allowedPayoutRecipients;
  if (typeof patch.autoPayoutsEnabled === "boolean")
    safe.autoPayoutsEnabled = patch.autoPayoutsEnabled;
  const [u] = await db
    .update(automationRules)
    .set(safe)
    .where(eq(automationRules.id, r.id))
    .returning();
  return u;
}

async function dayAutoTotal(facilityId: number): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      s: sql<number>`coalesce(sum(${automationLog.amountFcfa}),0)`,
    })
    .from(automationLog)
    .where(
      and(
        eq(automationLog.facilityId, facilityId),
        eq(automationLog.status, "auto_approved"),
        gte(automationLog.createdAt, start)
      )
    );
  return Number(rows[0]?.s || 0);
}

export interface AutoDecision {
  auto: boolean;
  reason?: string;
  logId?: number;
  waLink?: string;
}

export async function tryAutoApprove(input: {
  facilityId: number;
  paymentId: number | null;
  amount: number;
  reference: string;
  counterparty: string;
  kind: string;
}): Promise<AutoDecision> {
  const rules = await getRules(input.facilityId);
  const adminWa = process.env.ADMIN_WA || "22871692401";
  const waLink = `https://wa.me/${adminWa}?text=${encodeURIComponent(
    `🔔 SantéConnect — transaction AUTOMATIQUE\n💰 ${input.amount.toLocaleString("fr-FR")} F CFA\n🧾 Réf : ${input.reference}\n👤 ${input.counterparty}\n⏱ Fenêtre d'annulation : ${rules.cancelWindowMinutes} min (Centre d'automatisation).`
  )}`;

  if (!rules.autoApprovePayments)
    return { auto: false, reason: "Automatisation désactivée — validation manuelle requise." };
  if (input.amount > rules.maxPerTransactionFcfa)
    return {
      auto: false,
      reason: `Montant supérieur au plafond par transaction (${rules.maxPerTransactionFcfa.toLocaleString("fr-FR")} F).`,
    };
  const total = await dayAutoTotal(input.facilityId);
  if (total + input.amount > rules.maxPerDayFcfa)
    return {
      auto: false,
      reason: `Plafond journalier automatique atteint (${rules.maxPerDayFcfa.toLocaleString("fr-FR")} F).`,
    };

  const [log] = await db
    .insert(automationLog)
    .values({
      facilityId: input.facilityId,
      kind: input.kind,
      reference: input.reference,
      amountFcfa: input.amount,
      counterparty: input.counterparty,
      status: "auto_approved",
      decision: "auto",
      relatedPaymentId: input.paymentId,
      notifyWaLink: waLink,
    })
    .returning();

  return { auto: true, logId: log.id, waLink };
}

export async function reverseAuto(logId: number) {
  const rows = await db
    .select()
    .from(automationLog)
    .where(eq(automationLog.id, logId))
    .limit(1);
  const log = rows[0];
  if (!log) return { ok: false, error: "Transaction introuvable" };
  if (log.status !== "auto_approved")
    return { ok: false, error: "Cette transaction a déjà été traitée." };
  const rules = await getRules(log.facilityId);
  const age = Date.now() - new Date(log.createdAt).getTime();
  if (age > rules.cancelWindowMinutes * 60000)
    return { ok: false, error: `Fenêtre d'annulation (${rules.cancelWindowMinutes} min) dépassée.` };

  await db
    .update(automationLog)
    .set({ status: "reversed", reversedAt: new Date() })
    .where(eq(automationLog.id, logId));

  if (log.relatedPaymentId) {
    const pr = await db
      .select()
      .from(payments)
      .where(eq(payments.id, log.relatedPaymentId))
      .limit(1);
    if (pr[0]) {
      await db
        .update(payments)
        .set({ status: "reversed" })
        .where(eq(payments.id, log.relatedPaymentId));
      await db
        .update(subscriptions)
        .set({ status: "past_due", updatedAt: new Date() })
        .where(eq(subscriptions.facilityId, pr[0].facilityId));
    }
  }
  return { ok: true };
}
