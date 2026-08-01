import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, facilities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// Réservé à l'administrateur : liste des paiements manuels en attente de validation
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    }

    const rows = await db
      .select({
        id: payments.id,
        facilityId: payments.facilityId,
        planId: payments.planId,
        billingCycle: payments.billingCycle,
        amountFcfa: payments.amountFcfa,
        method: payments.method,
        status: payments.status,
        providerTxId: payments.providerTxId,
        createdAt: payments.createdAt,
        facilityName: facilities.name,
      })
      .from(payments)
      .leftJoin(facilities, eq(payments.facilityId, facilities.id))
      .where(eq(payments.status, "pending"))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Pending payments error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
