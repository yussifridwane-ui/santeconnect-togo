import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSubscription, computeState, getUsage } from "@/lib/billing";
import { getPlan } from "@/lib/plans";
import { cinetpayConfigured } from "@/lib/cinetpay";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role === "patient" || !session.facilityId) {
      return NextResponse.json({ skipped: true });
    }

    const subscription = await ensureSubscription(session.facilityId);
    const state = computeState(subscription);
    const usage = await getUsage(session.facilityId);
    const plan = getPlan(subscription.planId);

    return NextResponse.json({
      subscription,
      state,
      usage,
      plan,
      cinetpayConfigured,
    });
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
