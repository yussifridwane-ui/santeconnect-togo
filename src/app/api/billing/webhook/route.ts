import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { activateSubscription } from "@/lib/billing";
import { cinetpayConfigured, verifyCinetpayPayment } from "@/lib/cinetpay";
import type { PlanId } from "@/lib/plans";

// Notification serveur CinetPay après paiement Mobile Money (Flooz / T-Money)
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    const text = await request.text();
    try {
      body = JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      params.forEach((v, k) => (body[k] = v));
    }

    const txId = body.transaction_id || body.c_tx_id || body.tx_id;
    if (!txId) return NextResponse.json({ error: "transaction manquant" }, { status: 400 });

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.providerTxId, String(txId)))
      .limit(1);
    const payment = rows[0];
    if (!payment) return NextResponse.json({ error: "paiement inconnu" }, { status: 404 });
    if (payment.status === "succeeded") return NextResponse.json({ ok: true });

    const paid = cinetpayConfigured
      ? await verifyCinetpayPayment(String(txId))
      : String(body.status || "").toUpperCase().includes("ACCEPT");

    if (paid) {
      await db
        .update(payments)
        .set({ status: "succeeded", paidAt: new Date() })
        .where(eq(payments.id, payment.id));
      await activateSubscription(
        payment.facilityId,
        payment.planId as PlanId,
        (payment.billingCycle as "monthly" | "yearly") || "monthly"
      );
    } else {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, payment.id));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Erreur webhook" }, { status: 500 });
  }
}
