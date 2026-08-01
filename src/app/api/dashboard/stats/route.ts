import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, facilities, patients, appointments, messages } from "@/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Total counts
    const totalFacilities = await db.select({ count: count() }).from(facilities);
    const totalPatients = await db.select({ count: count() }).from(patients);
    const totalAppointments = await db.select({ count: count() }).from(appointments);
    const totalMessages = await db.select({ count: count() }).from(messages);

    // Unread messages
    const unreadMessages = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.status, "unread"));

    // Upcoming appointments (next 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingAppointments = await db
      .select()
      .from(appointments)
      .where(
        sql`${appointments.scheduledDate} >= ${now} AND ${appointments.scheduledDate} <= ${weekFromNow}`
      )
      .orderBy(desc(appointments.scheduledDate));

    // Recent appointments
    const recentAppointments = await db
      .select()
      .from(appointments)
      .orderBy(desc(appointments.createdAt))
      .limit(5);

    // Appointment status breakdown
    const statusCounts = await db
      .select({
        status: appointments.status,
        count: count(),
      })
      .from(appointments)
      .groupBy(appointments.status);

    // Recent messages
    const recentMessages = await db
      .select({
        id: messages.id,
        subject: messages.subject,
        senderId: messages.senderId,
        status: messages.status,
        createdAt: messages.createdAt,
        senderName: users.fullName,
        isSystemMessage: messages.isSystemMessage,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .orderBy(desc(messages.createdAt))
      .limit(5);

    // Today's appointments
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todaysAppointments = await db
      .select()
      .from(appointments)
      .where(
        sql`${appointments.scheduledDate} >= ${todayStart} AND ${appointments.scheduledDate} < ${todayEnd}`
      );

    return NextResponse.json({
      stats: {
        totalFacilities: totalFacilities[0].count,
        totalPatients: totalPatients[0].count,
        totalAppointments: totalAppointments[0].count,
        totalMessages: totalMessages[0].count,
        unreadMessages: unreadMessages[0].count,
        upcomingAppointments: upcomingAppointments.length,
        todaysAppointments: todaysAppointments.length,
      },
      recentAppointments,
      recentMessages,
      statusBreakdown: Object.fromEntries(
        statusCounts.map((s) => [s.status, s.count])
      ),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
