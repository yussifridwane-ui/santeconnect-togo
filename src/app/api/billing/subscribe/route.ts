import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getPlan, type PlanId } from "@/lib/plans";
import { activateSubscription, getSubscription } from "@/lib/billing";
import { cinetpayConfigured, createCinetpayPayment } from "@/lib/cinetpay";
import { PAYOUT, mixxUssdSteps } from "@/lib/payment-config";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!session.facilityId) {
      return NextResponse.json({ error: "Aucun cabinet associé" }, { status: 400 });
    }

    const body = await request.json();
    const planId = (body.planId || "pro") as PlanId;
    const cycle = body.cycle === "yearly" ? "yearly" : "monthly";
    const method =
      body.method === "tmoney" ? "tmoney" : body.method === "manual" ? "manual" : "flooz";
    const phone = String(body.phone || "");

    const plan = getPlan(planId);
    const amount = cycle === "yearly" ? plan.priceYearlyFcfa : plan.priceMonthlyFcfa;

    const sub = await getSubscription(session.facilityId);
    const txId = `SC${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

    const [payment] = await db
      .insert(payments)
      .values({
        facilityId: session.facilityId,
        subscriptionId: sub?.id || null,
        planId,
        billingCycle: cycle,
        amountFcfa: amount,
        method,
        providerTxId: txId,
        status: "pending",
        description: `Abonnement ${plan.name} (${cycle === "yearly" ? "annuel" : "mensuel"}) — ${session.fullName}`,
      })
      .returning();

    // PAIEMENT MANUEL via Mixx by Yas : le client transfère, l'admin valide ensuite
    if (method === "manual") {
      return NextResponse.json({
        manual: true,
        paymentId: payment.id,
        instructions: {
          amountFcfa: amount,
          reference: txId,
          methodLabel: "Mixx by Yas (T-Money)",
          number: PAYOUT.mixxNumber,
          beneficiary: PAYOUT.beneficiary,
          steps: mixxUssdSteps(PAYOUT.mixxNumber, amount),
        },
      });
    }

    if (cinetpayConfigured) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        request.nextUrl.origin;
      try {
        const { paymentUrl } = await createCinetpayPayment({
          txId,
          amountFcfa: amount,
          description: payment.description || "SantéOnline Togo",
          customerName: session.fullName,
          customerPhone: phone,
          notifyUrl: `${appUrl}/api/billing/webhook`,
          returnUrl: `${appUrl}/dashboard/billing`,
        });
        return NextResponse.json({ redirect: paymentUrl, paymentId: payment.id });
      } catch (e: any) {
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.id, payment.id));
        return NextResponse.json(
          { error: e.message || "Erreur du prestataire de paiement" },
          { status: 502 }
        );
      }
    }

    // MODE DÉMO : paiement Mobile Money simulé (aucune clé CinetPay configurée)
    await db
      .update(payments)
      .set({ status: "succeeded", paidAt: new Date() })
      .where(eq(payments.id, payment.id));
    await activateSubscription(session.facilityId, planId, cycle);

    return NextResponse.json({
      demo: true,
      success: true,
      plan: plan.name,
      message:
        "Paiement Mobile Money simulé (mode démo). Ajoutez vos clés CinetPay pour activer Flooz / T-Money réels.",
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
