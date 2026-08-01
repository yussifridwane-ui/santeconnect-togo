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

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || session.id.toString();

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
          eq(messages.senderId, parseInt(userId)),
          eq(messages.receiverId, parseInt(userId))
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

    const body = await request.json();

    const newMessage = await db
      .insert(messages)
      .values({
        senderId: parseInt(body.senderId),
        receiverId: parseInt(body.receiverId),
        facilityId: body.facilityId ? parseInt(body.facilityId) : null,
        subject: body.subject,
        content: body.content,
        status: "unread",
        isSystemMessage: body.isSystemMessage || false,
      })
      .returning();

    return NextResponse.json(newMessage[0], { status: 201 });
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
