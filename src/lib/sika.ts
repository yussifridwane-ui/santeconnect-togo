import { db } from "@/db";
import { shops, sikaSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SIKA_PLANS = {
  free: { id: "free", name: "Découverte", priceMonthlyFcfa: 0, maxProducts: 30, wa: false, ai: false },
  pro: { id: "pro", name: "Pro", priceMonthlyFcfa: 10000, maxProducts: 999999, wa: true, ai: true },
  business: { id: "business", name: "Business", priceMonthlyFcfa: 25000, maxProducts: 999999, wa: true, ai: true, multi: true },
} as const;

export const SIKA_TRIAL_DAYS = 14;

export async function getShopForUser(userId: number) {
  const rows = await db.select().from(shops).where(eq(shops.ownerId, userId)).limit(1);
  return rows[0] || null;
}

export async function getShopSub(shopId: number) {
  const rows = await db.select().from(sikaSubscriptions).where(eq(sikaSubscriptions.shopId, shopId)).limit(1);
  return rows[0] || null;
}

export async function ensureShopSub(shopId: number) {
  const existing = await getShopSub(shopId);
  if (existing) return existing;
  const [r] = await db
    .insert(sikaSubscriptions)
    .values({
      shopId,
      plan: "pro",
      status: "trialing",
      trialEndsAt: new Date(Date.now() + SIKA_TRIAL_DAYS * 86400000),
    })
    .returning();
  return r;
}

export function shopSubState(sub: any) {
  const now = Date.now();
  if (!sub) return { allowed: false, status: "blocked", daysLeft: 0, message: "Aucun abonnement." };
  if (sub.plan === "free") return { allowed: true, status: "free", daysLeft: null, message: "Formule Découverte (gratuite)." };
  if (sub.status === "trialing" && sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() > now) {
    const daysLeft = Math.ceil((new Date(sub.trialEndsAt).getTime() - now) / 86400000);
    return { allowed: true, status: "trialing", daysLeft, message: `Essai Pro — ${daysLeft} j restants.` };
  }
  if (sub.status === "active" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() > now) {
    return { allowed: true, status: "active", daysLeft: null, message: "Abonnement actif." };
  }
  return { allowed: false, status: "blocked", daysLeft: 0, message: "Essai terminé ou abonnement expiré. Passez à une formule payante." };
}

export async function activateShopSub(shopId: number, plan: "pro" | "business") {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 86400000);
  const existing = await getShopSub(shopId);
  if (existing) {
    await db
      .update(sikaSubscriptions)
      .set({ plan, status: "active", currentPeriodEnd: end })
      .where(eq(sikaSubscriptions.id, existing.id));
  } else {
    await db.insert(sikaSubscriptions).values({ shopId, plan, status: "active", currentPeriodEnd: end });
  }
}
