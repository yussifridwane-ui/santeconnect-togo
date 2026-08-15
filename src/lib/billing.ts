import { db } from "@/db";
import { subscriptions, patients, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { getPlan, TRIAL_DAYS, type PlanId } from "./plans";

export type Subscription = typeof subscriptions.$inferSelect;

export async function getSubscription(facilityId: number) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.facilityId, facilityId))
    .limit(1);
  return rows[0] || null;
}

export async function ensureSubscription(facilityId: number): Promise<Subscription> {
  const existing = await getSubscription(facilityId);
  if (existing) return existing;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000);
  const rows = await db
    .insert(subscriptions)
    .values({
      facilityId,
      planId: "pro",
      billingCycle: "monthly",
      status: "trialing",
      trialEndsAt,
    })
    .returning();
  return rows[0];
}

export interface BillingState {
  allowed: boolean;
  status: "trialing" | "active" | "blocked";
  daysLeft: number | null;
  renewalDate: string | null;
  message: string;
}

export function computeState(sub: Subscription | null): BillingState {
  const now = Date.now();
  const day = 86400000;
  if (!sub) {
    return {
      allowed: false,
      status: "blocked",
      daysLeft: null,
      renewalDate: null,
      message: "Aucun abonnement trouvé pour ce cabinet. Contactez l'administrateur.",
    };
  }
  if (sub.status === "trialing") {
    if (sub.trialEndsAt && sub.trialEndsAt.getTime() > now) {
      const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - now) / day);
      return {
        allowed: true,
        status: "trialing",
        daysLeft,
        renewalDate: null,
        message: `Essai gratuit Pro — ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}.`,
      };
    }
    return {
      allowed: false,
      status: "blocked",
      daysLeft: 0,
      renewalDate: null,
      message:
        "Votre essai gratuit de 14 jours est terminé. Souscrivez une formule pour continuer à utiliser SantéOnline.",
    };
  }
  if (sub.status === "active") {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now) {
      return {
        allowed: true,
        status: "active",
        daysLeft: null,
        renewalDate: sub.currentPeriodEnd.toISOString(),
        message: "Abonnement actif.",
      };
    }
    return {
      allowed: false,
      status: "blocked",
      daysLeft: 0,
      renewalDate: sub.currentPeriodEnd?.toISOString() || null,
      message:
        "Votre abonnement a expiré. Renouvelez par Flooz ou T-Money pour réactiver l'accès de votre cabinet.",
    };
  }
  return {
    allowed: false,
    status: "blocked",
    daysLeft: null,
    renewalDate: null,
    message: "L'accès de ce cabinet est suspendu. Régularisez votre abonnement pour continuer.",
  };
}

export async function getUsage(facilityId: number) {
  const [p] = await db
    .select({ c: count() })
    .from(patients)
    .where(eq(patients.facilityId, facilityId));
  const [u] = await db
    .select({ c: count() })
    .from(users)
    .where(eq(users.facilityId, facilityId));
  return { patients: p.c, users: u.c };
}

export async function activateSubscription(
  facilityId: number,
  planId: PlanId,
  cycle: "monthly" | "yearly"
) {
  const now = new Date();
  const end = new Date(now.getTime() + (cycle === "yearly" ? 365 : 30) * 86400000);
  const existing = await getSubscription(facilityId);
  if (existing) {
    await db
      .update(subscriptions)
      .set({
        planId,
        billingCycle: cycle,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: end,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      facilityId,
      planId,
      billingCycle: cycle,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: end,
    });
  }
  return getPlan(planId);
}
