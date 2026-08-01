import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, facilities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, setSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: "Identifiants incorrects" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user[0].password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Identifiants incorrects" },
        { status: 401 }
      );
    }

    if (!user[0].isActive) {
      return NextResponse.json(
        { error: "Compte désactivé" },
        { status: 403 }
      );
    }

    await setSession({
      id: user[0].id,
      fullName: user[0].fullName,
      email: user[0].email,
      role: user[0].role,
      facilityId: user[0].facilityId,
    });

    return NextResponse.json({
      user: {
        id: user[0].id,
        fullName: user[0].fullName,
        email: user[0].email,
        role: user[0].role,
        facilityId: user[0].facilityId,
        phone: user[0].phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
