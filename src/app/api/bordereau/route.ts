import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureMigrated } from "@/db/migrate";

/**
 * 📋 BORDEREAU DES ASSUREURS (V2.7)
 * GET ?month=2026-08 → tout ce que chaque assureur doit à l'établissement
 * pour le mois donné (feuilles de soins non encore réglées), groupé par assureur :
 * c'est le document que la caisse envoie à l'INAM / SUNU / NSIA… pour réclamation.
 * Rôles : admin + secretary.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!["admin", "secretary"].includes(session.role)) {
      return NextResponse.json({ error: "Accès réservé à la caisse." }, { status: 403 });
    }
    await ensureMigrated();

    const sp = request.nextUrl.searchParams;
    const month = /^\d{4}-\d{2}$/.test(sp.get("month") || "")
      ? sp.get("month")!
      : new Date().toISOString().slice(0, 7);
    const facilityId = session.facilityId || -1;

    const rows = await pool.query(
      `SELECT i.id, i.number, i.care_sheet_number, i.total_fcfa, i.insurer_share_fcfa,
              i.insurer_status, i.created_at,
              up.full_name AS patient_name,
              s.id AS insurer_id, s.name AS insurer_name, s.rate, s.phone AS insurer_phone
       FROM invoices i
       JOIN insurers s ON s.id = i.insurer_id
       LEFT JOIN patients p ON p.id = i.patient_id
       LEFT JOIN users up ON up.id = p.user_id
       WHERE i.facility_id = $1
         AND to_char(i.created_at, 'YYYY-MM') = $2
         AND i.insurer_share_fcfa > 0
       ORDER BY s.name, i.created_at`,
      [facilityId, month],
    );

    /* Groupement par assureur (zéro suppression — simple assemblage d'affichage) */
    const byInsurer: Record<number, {
      insurerId: number; insurerName: string; rate: number; phone: string | null;
      lines: {
        id: number; number: string; careSheet: string | null; date: string;
        patientName: string | null; total: number; insurerShare: number; settled: boolean;
      }[];
      total: number; pending: number;
    }> = {};
    let grandTotal = 0;
    let grandPending = 0;
    for (const r of rows.rows) {
      if (!byInsurer[r.insurer_id]) {
        byInsurer[r.insurer_id] = {
          insurerId: r.insurer_id, insurerName: r.insurer_name, rate: r.rate,
          phone: r.insurer_phone, lines: [], total: 0, pending: 0,
        };
      }
      byInsurer[r.insurer_id].lines.push({
        id: r.id, number: r.number, careSheet: r.care_sheet_number,
        date: r.created_at, patientName: r.patient_name,
        total: Number(r.total_fcfa), insurerShare: Number(r.insurer_share_fcfa),
        settled: r.insurer_status === "reglee",
      });
      byInsurer[r.insurer_id].total += Number(r.insurer_share_fcfa);
      grandTotal += Number(r.insurer_share_fcfa);
      if (r.insurer_status !== "reglee") {
        byInsurer[r.insurer_id].pending += Number(r.insurer_share_fcfa);
        grandPending += Number(r.insurer_share_fcfa);
      }
    }

    return NextResponse.json({
      month,
      insurers: Object.values(byInsurer),
      grandTotal,
      grandPending,
    });
  } catch (e) {
    console.error("bordereau GET:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
