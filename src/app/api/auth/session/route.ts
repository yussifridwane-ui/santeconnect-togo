import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user: session });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { clearSession } = await import("@/lib/auth");
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
