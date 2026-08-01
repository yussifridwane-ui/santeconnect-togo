import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { tryAutoApprove } from "@/lib/automation";
import { activateSubscription } from "@/lib/billing";
import type { PlanId } from "@/lib/plans";

// Le client déclare avoir payé (n° de transaction Mixx).
// Selon les règles d'automatisation : activation immédiate OU file manuelle.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!session.facilityId) return NextResponse.json({ error: "Aucun cabinet" }, { status: 400 });

    const body = await request.json();
    const paymentId = parseInt(body.paymentId);
    const txRef = String(body.txRef || "").trim();

    const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    const payment = rows[0];
    if (!payment || payment.facilityId !== session.facilityId)
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    if (payment.status === "succeeded")
      return NextResponse.json({ already: true, autoApproved: true });
    if (payment.status !== "pending")
      return NextResponse.json({ error: "Paiement déjà traité" }, { status: 400 });

    const reference = txRef || payment.providerTxId || String(payment.id);
    if (txRef) {
      await db.update(payments).set({ providerTxId: txRef }).where(eq(payments.id, paymentId));
    }

    const decision = await tryAutoApprove({
      facilityId: session.facilityId,
      paymentId: payment.id,
      amount: payment.amountFcfa,
      reference,
      counterparty: session.fullName,
      kind: "subscription_payment",
    });

    if (decision.auto) {
      await db
        .update(payments)
        .set({ status: "succeeded", paidAt: new Date() })
        .where(eq(payments.id, paymentId));
      await activateSubscription(
        session.facilityId,
        payment.planId as PlanId,
        (payment.billingCycle as "monthly" | "yearly") || "monthly"
      );
      return NextResponse.json({
        autoApproved: true,
        waLink: decision.waLink,
        message: "Paiement validé automatiquement selon vos règles. Abonnement activé.",
      });
    }

    return NextResponse.json({
      autoApproved: false,
      reason: decision.reason,
      message: "Paiement enregistré. Validation manuelle requise (règles de sécurité).",
    });
  } catch (error) {
    console.error("Declare error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
