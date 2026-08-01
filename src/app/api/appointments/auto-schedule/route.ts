import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, users, facilities, patients, messages } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSubscription, computeState } from "@/lib/billing";
import { getPlan } from "@/lib/plans";

// Auto-schedule logic: Creates follow-up appointments for patients who need them
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Garde-fou SaaS : la planification automatique est une fonctionnalité Pro/Business
    if (session.facilityId) {
      const sub = await ensureSubscription(session.facilityId);
      const state = computeState(sub);
      if (!state.allowed) {
        return NextResponse.json({ error: state.message }, { status: 403 });
      }
      if (!getPlan(sub.planId).autoSchedule) {
        return NextResponse.json(
          { error: "La planification automatique est incluse à partir de la formule Pro." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const scheduledAppointments: any[] = [];

    // Option 1: Auto-schedule for a specific patient
    if (body.patientId) {
      const patient = await db
        .select()
        .from(patients)
        .where(eq(patients.id, parseInt(body.patientId)))
        .limit(1);

      if (patient.length > 0) {
        const facilityId = body.facilityId || 1;
        const facility = await db
          .select()
          .from(facilities)
          .where(eq(facilities.id, facilityId))
          .limit(1);

        if (facility.length > 0) {
          // Find the patient's user ID
          const user = await db
            .select()
            .from(users)
            .where(eq(users.id, patient[0].userId))
            .limit(1);

          // Determine appointment type based on medical notes
          let appointmentType: "consultation" | "lab_test" | "follow_up" | "emergency" | "specialist" = "follow_up";
          let title = "Rendez-vous de suivi";
          let doctorId = null;

          if (patient[0].medicalNotes?.includes("cardiaque")) {
            appointmentType = "specialist";
            title = "Suivi cardiologique automatique";
          } else if (patient[0].medicalNotes?.includes("diabète") || patient[0].medicalNotes?.includes("Diabète")) {
            appointmentType = "follow_up";
            title = "Contrôle diabétique automatique";
          } else if (patient[0].medicalNotes?.includes("prénatal")) {
            appointmentType = "consultation";
            title = "Suivi prénatal automatique";
          }

          // Find a doctor at the facility
          const doctors = await db
            .select()
            .from(users)
            .where(
              sql`${users.role} = 'doctor' AND ${users.facilityId} = ${facilityId}`
            )
            .limit(1);

          if (doctors.length > 0) {
            doctorId = doctors[0].id;
          }

          // Schedule 7 days from now
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 7);
          scheduledDate.setHours(9, 0, 0, 0);
          const endDate = new Date(scheduledDate.getTime() + 30 * 60000);

          const newAppointment = await db
            .insert(appointments)
            .values({
              patientId: patient[0].id,
              facilityId,
              doctorId,
              title,
              type: appointmentType,
              status: "pending",
              scheduledDate,
              endDate,
              notes: "Rendez-vous planifié automatiquement par le système",
              isAutoScheduled: true,
            })
            .returning();

          scheduledAppointments.push(newAppointment[0]);

          // Send notification message
          if (user.length > 0) {
            await db.insert(messages).values({
              senderId: session.id,
              receiverId: user[0].id,
              facilityId,
              subject: "Nouveau rendez-vous automatique programmé",
              content: `Bonjour ${user[0].fullName},\n\nUn rendez-vous a été automatiquement programmé pour vous.\n\nType: ${title}\nDate: ${scheduledDate.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} à ${scheduledDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}\nÉtablissement: ${facility[0].name}\n\nCordialement,\nSystème de gestion des rendez-vous`,
              status: "unread",
              isSystemMessage: true,
            });
          }
        }
      }
    } else {
      // Option 2: Auto-schedule for all patients who need follow-ups
      // Find patients with completed appointments needing follow-up
      const completedAppointments = await db
        .select({
          patientId: appointments.patientId,
          facilityId: appointments.facilityId,
          notes: appointments.notes,
          scheduledDate: appointments.scheduledDate,
        })
        .from(appointments)
        .where(
          sql`${appointments.status} = 'completed' AND ${appointments.isAutoScheduled} = true`
        )
        .orderBy(desc(appointments.scheduledDate))
        .limit(10);

      for (const apt of completedAppointments) {
        // Check if patient already has a pending appointment
        const existing = await db
          .select()
          .from(appointments)
          .where(
            sql`${appointments.patientId} = ${apt.patientId} AND (${appointments.status} = 'pending' OR ${appointments.status} = 'confirmed')`
          )
          .limit(1);

        if (existing.length === 0) {
          const patient = await db
            .select()
            .from(patients)
            .where(eq(patients.id, apt.patientId))
            .limit(1);

          if (patient.length > 0) {
            const scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + 14);
            scheduledDate.setHours(10, 0, 0, 0);
            const endDate = new Date(scheduledDate.getTime() + 30 * 60000);

            const newApt = await db
              .insert(appointments)
              .values({
                patientId: apt.patientId,
                facilityId: apt.facilityId,
                title: "Rendez-vous de suivi automatique",
                type: "follow_up",
                status: "pending",
                scheduledDate,
                endDate,
                notes: "Planifié automatiquement suite au dernier rendez-vous",
                isAutoScheduled: true,
              })
              .returning();

            scheduledAppointments.push(newApt[0]);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      scheduled: scheduledAppointments.length,
      appointments: scheduledAppointments,
    });
  } catch (error) {
    console.error("Auto-schedule error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
