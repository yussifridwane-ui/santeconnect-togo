import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, users, facilities } from "@/db/schema";
import { eq, desc, or, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    /* 🛡️ V2.8 — IDOR : on lit UNIQUEMENT ses propres messages. Le paramètre
       userId du client est désormais ignoré (confidentialité inter-personnel). */
    const userId = session.id;

    const result = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        facilityId: messages.facilityId,
        subject: messages.subject,
        content: messages.content,
        status: messages.status,
        isSystemMessage: messages.isSystemMessage,
        createdAt: messages.createdAt,
        senderName: users.fullName,
        facilityName: facilities.name,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .leftJoin(facilities, eq(messages.facilityId, facilities.id))
      .where(
        or(
          eq(messages.senderId, userId),
          eq(messages.receiverId, userId)
        )
      )
      .orderBy(desc(messages.createdAt));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    /* 🛡️ V2.8 — La messagerie interne est réservée au PERSONNEL de santé */
    if (!["admin", "doctor", "nurse", "secretary", "lab", "pharmacist"].includes(session.role)) {
      return NextResponse.json({ error: "Messagerie réservée au personnel" }, { status: 403 });
    }
    /* Rate limiting : max 30 messages / minute / utilisateur */
    const { rateLimit } = await import("@/lib/auth");
    if (!rateLimit(`messages:${session.id}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: "Trop de messages envoyés. Respire un peu 🙂" }, { status: 429 });
    }

    const body = await request.json();

    /* 🛡️ V2.8 — senderId et facilityId viennent de la SESSION serveur, jamais
       du client : impossible d'écrire au nom de quelqu'un d'autre (usurpation),
       ni d'envoyer un message « système » soi-même. */
    const newMessage = await db
      .insert(messages)
      .values({
        senderId: session.id,
        receiverId: parseInt(body.receiverId),
        facilityId: session.facilityId || null,
        subject: String(body.subject || "").slice(0, 200),
        content: String(body.content || "").slice(0, 5000),
        status: "unread",
        isSystemMessage: false,
      })
      .returning();

    return NextResponse.json(newMessage[0], { status: 201 });
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
