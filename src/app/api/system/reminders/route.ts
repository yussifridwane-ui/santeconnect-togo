import { NextRequest, NextResponse } from "next/server";
import { ensureMigrated } from "@/db/migrate";
import { runDueReminders } from "@/lib/reminders";

/**
 * POST /api/system/reminders — endpoint du balayage automatique.
 * Appelé par la fonction Netlify programmée (toutes les heures) ;
 * protégé par CRON_SECRET quand la variable est configurée.
 */
export async function POST(request: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret && request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Interdit" }, { status: 401 });
  }
  try {
    await ensureMigrated();
    const origin = new URL(request.url).origin;
    const r = await runDueReminders(origin);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[system/reminders]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
