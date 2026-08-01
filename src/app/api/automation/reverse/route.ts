import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reverseAuto } from "@/lib/automation";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });

    const body = await request.json();
    const result = await reverseAuto(parseInt(body.logId));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reverse error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
