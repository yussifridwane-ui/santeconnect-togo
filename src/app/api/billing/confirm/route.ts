import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { activateSubscription } from "@/lib/billing";
import type { PlanId } from "@/lib/plans";

// L'administrateur confirme la réception d'un paiement Mobile Money manuel
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    }

    const body = await request.json();
    const paymentId = parseInt(body.paymentId);
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId requis" }, { status: 400 });
    }

    const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    const payment = rows[0];
    if (!payment) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }
    if (payment.status === "succeeded") {
      return NextResponse.json({ ok: true, already: true });
    }

    await db
      .update(payments)
      .set({ status: "succeeded", paidAt: new Date() })
      .where(eq(payments.id, paymentId));

    await activateSubscription(
      payment.facilityId,
      payment.planId as PlanId,
      (payment.billingCycle as "monthly" | "yearly") || "monthly"
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Confirm payment error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
