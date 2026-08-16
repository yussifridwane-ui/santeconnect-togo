import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, facilities, patients } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSubscription, computeState } from "@/lib/billing";
import { runDueReminders } from "@/lib/reminders";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const currentFacilityId = session.facilityId || 1;

    // Filter appointments for the current facility/cabinet to ensure isolation
    const appointmentsWithDetails = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        facilityId: appointments.facilityId,
        doctorId: appointments.doctorId,
        title: appointments.title,
        type: appointments.type,
        status: appointments.status,
        scheduledDate: appointments.scheduledDate,
        endDate: appointments.endDate,
        notes: appointments.notes,
        isAutoScheduled: appointments.isAutoScheduled,
        createdAt: appointments.createdAt,
        patientResponse: appointments.patientResponse,
        patientName: patients.userId, // placeholder
        doctorName: users.fullName,
        facilityName: facilities.name,
        facilityType: facilities.type,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .leftJoin(facilities, eq(appointments.facilityId, facilities.id))
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(eq(appointments.facilityId, currentFacilityId))
      .orderBy(desc(appointments.scheduledDate));

    // Fetch patient names and phone numbers separately
    const patientIds = [...new Set(appointmentsWithDetails.map((a) => a.patientId))].filter(
      (id): id is number => id != null
    );
    const patientUsers =
      patientIds.length > 0
        ? await db
            .select({
              id: patients.id,
              fullName: users.fullName,
              phone: users.phone,
            })
            .from(patients)
            .innerJoin(users, eq(patients.userId, users.id))
        : [];
    const patientNameMap = new Map(patientUsers.map((p) => [p.id, p.fullName]));
    const patientPhoneMap = new Map(patientUsers.map((p) => [p.id, p.phone]));

    let result = appointmentsWithDetails.map((a) => ({
      ...a,
      patientName: a.patientId ? patientNameMap.get(a.patientId) || null : null,
      patientPhone: a.patientId ? patientPhoneMap.get(a.patientId) || null : null,
    }));

    // V2.2 — CONFIDENTIALITÉ : un patient ne voit que SES rendez-vous, jamais ceux des autres
    if (session.role === "patient") {
      const me = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.userId, session.id))
        .limit(1);
      if (me.length === 0) return NextResponse.json([]);
      const myPid = me[0].id;
      result = result.filter((a) => a.patientId === myPid);
    }

    // V2.3 — balayage des rappels RDV automatiques (aucune manipulation humaine)
    try {
      await runDueReminders(new URL(request.url).origin);
    } catch (e) {
      console.error("[rappels]", e);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get appointments error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const currentFacilityId = session.facilityId || 1;
    const body = await request.json();

    // Garde-fou SaaS : impossible de créer un RDV si l'abonnement est suspendu
    const sub = await ensureSubscription(currentFacilityId);
    const state = computeState(sub);
    if (!state.allowed) {
      return NextResponse.json({ error: state.message }, { status: 403 });
    }

    const scheduledDate = new Date(body.scheduledDate);
    const duration = body.duration || 30;
    const endDate = new Date(scheduledDate.getTime() + duration * 60000);

    /* 🛡️ V2.8 — IDOR : un PATIENT ne peut créer un RDV que pour LUI-MÊME,
       toujours en statut « pending ». Le patientId du client est ignoré. */
    let patientId: number;
    let status = body.status || "pending";
    if (session.role === "patient") {
      const { pool } = await import("@/db");
      const pr = await pool.query(`SELECT id FROM patients WHERE user_id = $1`, [session.id]);
      if (!pr.rows[0]) {
        return NextResponse.json({ error: "Aucun dossier patient lié à ce compte." }, { status: 404 });
      }
      patientId = pr.rows[0].id;
      status = "pending";
    } else {
      patientId = parseInt(body.patientId);
    }
    if (!patientId || isNaN(patientId)) {
      return NextResponse.json({ error: "Patient manquant ou invalide." }, { status: 400 });
    }

    const newAppointment = await db
      .insert(appointments)
      .values({
        patientId,
        facilityId: currentFacilityId, // Always bind to the current clinic/cabinet
        doctorId: body.doctorId ? parseInt(body.doctorId) : null,
        title: body.title,
        type: body.type || "consultation",
        status,
        scheduledDate,
        endDate,
        notes: body.notes,
        isAutoScheduled: body.isAutoScheduled || false,
      })
      .returning();

    return NextResponse.json(newAppointment[0], { status: 201 });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
