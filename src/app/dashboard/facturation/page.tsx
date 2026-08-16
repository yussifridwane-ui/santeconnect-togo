"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Receipt, Plus, Printer, Banknote, Search, Download, X, Trash2, Wallet,
} from "lucide-react";

/**
 * 🧾 FACTURATION & PAIEMENTS (V2.5 — Gestion de cabinet)
 * « Générez automatiquement vos factures et recevez les paiements. »
 * Rapport filtrable (Du / Au / statut / recherche), export CSV, création de
 * facture multi-lignes avec numéro automatique, encaissement T-Money / Flooz /
 * Espèces / Carte avec suivi partiel, impression professionnelle.
 */

const fmt = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const STATUS_LABELS: Record<string, string> = { unpaid: "Non payée", partial: "Partielle", paid: "Payée" };
const STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};
const METHOD_LABELS: Record<string, string> = {
  tmoney: "T-Money", flooz: "Flooz", cash: "Espèces", card: "Carte bancaire",
};
const KIND_LABELS: Record<string, string> = {
  consultation: "Consultation", examen: "Examen", medicament: "Médicament", acte: "Acte", service: "Service",
};

interface Invoice {
  id: number; number: string; total_fcfa: number; paid_fcfa: number;
  status: string; method: string | null; created_at: string;
  patient_name: string | null; patient_id: number | null; items_count: number;
  insurer_id?: number | null; insurer_name?: string | null; insurer_rate?: number | null;
  insurer_share_fcfa?: number; insured_number?: string | null;
  care_sheet_number?: string | null; insurer_status?: string;
}
interface Insurer { id: number; name: string; rate: number; phone: string | null }
interface PatientOpt { id: number; fullName: string; recordNumber?: string | null }
interface ItemRow { kind: string; label: string; qty: string; unitPrice: string }
interface BordereauLine {
  id: number; number: string; careSheet: string | null; date: string;
  patientName: string | null; total: number; insurerShare: number; settled: boolean;
}
interface BordereauGroup {
  insurerId: number; insurerName: string; rate: number; phone: string | null;
  lines: BordereauLine[]; total: number; pending: number;
}

export default function FacturationPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Invoice[]>([]);
  const [stats, setStats] = useState({ billed: 0, collected: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  /* Création */
  const [showNew, setShowNew] = useState(false);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [patientId, setPatientId] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([{ kind: "consultation", label: "", qty: "1", unitPrice: "" }]);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  /* Encaissement */
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  /* 🛡️ V2.7 — Assurances maladie */
  const [view, setView] = useState<"factures" | "bordereau">("factures");
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [insurerId, setInsurerId] = useState("");
  const [insuredNumber, setInsuredNumber] = useState("");
  const [bMonth, setBMonth] = useState(today.slice(0, 7));
  const [bordereau, setBordereau] = useState<BordereauGroup[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandPending, setGrandPending] = useState(0);
  const [showInsurers, setShowInsurers] = useState(false);
  const [newInsurer, setNewInsurer] = useState({ name: "", rate: "80", phone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (status !== "all") p.set("status", status);
      if (q.trim()) p.set("q", q.trim());
      const r = await fetch(`/api/invoices?${p.toString()}`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
        setStats(d.stats || { billed: 0, collected: 0, outstanding: 0 });
      } else if (r.status === 403) {
        setErr("Accès réservé à la caisse (admin/secrétaire).");
      }
    } finally {
      setLoading(false);
    }
  }, [from, to, status, q]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/patients").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setPatients(d);
    }).catch(() => {});
    fetch("/api/insurers").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.items)) setInsurers(d.items);
    }).catch(() => {});
  }, []);

  const loadBordereau = useCallback(async () => {
    const r = await fetch(`/api/bordereau?month=${bMonth}`);
    if (r.ok) {
      const d = await r.json();
      setBordereau(d.insurers || []);
      setGrandTotal(d.grandTotal || 0);
      setGrandPending(d.grandPending || 0);
    }
  }, [bMonth]);
  useEffect(() => { if (view === "bordereau") loadBordereau(); }, [view, loadBordereau]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  const flashErr = async (r: Response) => {
    const d = await r.json().catch(() => ({}));
    setErr(d.error || "Erreur serveur"); setTimeout(() => setErr(""), 5000);
  };

  const totalDraft = useMemo(() => {
    const t = rows.reduce((s, r) => s + (parseInt(r.qty) || 1) * (parseInt(r.unitPrice) || 0), 0);
    return Math.max(0, t - (parseInt(discount) || 0));
  }, [rows, discount]);

  const createInvoice = async () => {
    setBusy(true);
    const r = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId, discount, notes,
        insurerId: insurerId || undefined,
        insuredNumber: insuredNumber || undefined,
        items: rows.map((r) => ({
          kind: r.kind, label: r.label,
          qty: parseInt(r.qty) || 1, unitPrice: parseInt(r.unitPrice) || 0,
        })),
      }),
    });
    setBusy(false);
    if (r.ok) {
      const d = await r.json();
      setShowNew(false);
      setRows([{ kind: "consultation", label: "", qty: "1", unitPrice: "" }]);
      setPatientId(""); setDiscount(""); setNotes("");
      setInsurerId(""); setInsuredNumber("");
      flash(`✅ Facture ${d.number} créée.`);
      load();
    } else flashErr(r);
  };

  /* 🤝 L'assureur a payé sa part (INAM, SUNU…) */
  const settleInsurer = async (inv: Invoice) => {
    const r = await fetch(`/api/invoices/${inv.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle-insurer" }),
    });
    if (r.ok) { flash("🤝 Part assureur marquée comme réglée."); load(); }
    else flashErr(r);
  };

  const insurerDraftRate = insurers.find((s) => String(s.id) === insurerId)?.rate ?? 0;
  const insurerDraftShare = Math.round((totalDraft * insurerDraftRate) / 100);

  const pay = async () => {
    if (!payFor) return;
    const r = await fetch(`/api/invoices/${payFor.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", amount: payAmount, method: payMethod }),
    });
    if (r.ok) {
      const d = await r.json();
      flash(d.status === "paid" ? "✅ Facture soldée — le patient est notifié." : "🧾 Paiement partiel enregistré.");
      setPayFor(null); setPayAmount("");
      load();
    } else flashErr(r);
  };

  const printInvoice = async (id: number) => {
    const r = await fetch(`/api/invoices/${id}`);
    if (!r.ok) return flashErr(r);
    const { invoice: f, items: lignes } = await r.json();
    const reste = f.total_fcfa - (f.insurer_share_fcfa || 0) - f.paid_fcfa;
    const lignesHtml = (lignes as { kind: string; label: string; qty: number; unit_price_fcfa: number; total_fcfa: number }[])
      .map((l) => `<tr>
        <td>${KIND_LABELS[l.kind] || l.kind}</td><td>${l.label}</td>
        <td style="text-align:center">${l.qty}</td>
        <td style="text-align:right">${l.unit_price_fcfa.toLocaleString("fr-FR")}</td>
        <td style="text-align:right">${l.total_fcfa.toLocaleString("fr-FR")}</td>
      </tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${f.number}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:32px;color:#111}
        .head{display:flex;justify-content:space-between;border-bottom:3px solid #059669;padding-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th,td{border:1px solid #ddd;padding:8px 10px;font-size:14px}
        th{background:#f0fdf4;text-align:left}
        .tot{margin-top:16px;text-align:right;font-size:15px}
        .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:bold;font-size:13px}
        .ok{background:#d1fae5;color:#065f46}.ko{background:#fee2e2;color:#991b1b}.pa{background:#fef3c7;color:#92400e}
        .foot{margin-top:40px;font-size:12px;color:#666;border-top:1px solid #ddd;padding-top:10px}
      </style></head><body>
      <div class="head">
        <div><h2 style="margin:0;color:#059669">${f.facility_name || "SantéOnline"}</h2>
          <div style="font-size:13px;color:#555">${f.facility_address || ""}<br>${f.facility_phone || ""}</div></div>
        <div style="text-align:right"><h1 style="margin:0;font-size:22px">FACTURE</h1>
          <b>${f.number}</b><br>${new Date(f.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}</div>
      </div>
      <p style="margin-top:16px"><b>Patient :</b> ${f.patient_name || "—"} ${f.record_number ? `(Dossier ${f.record_number})` : ""}</p>
      ${f.insurer_name ? `<p style="margin:0 0 6px;font-size:14px;color:#3730a3"><b>Assurance :</b> 🛡️ ${f.insurer_name} (${f.insurer_rate} %)${f.insured_number ? ` · N° assuré : <b>${f.insured_number}</b>` : ""}${f.care_sheet_number ? ` · Feuille de soins : <b>${f.care_sheet_number}</b>` : ""}</p>` : ""}
      <table><thead><tr><th>Type</th><th>Libellé</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${lignesHtml}</tbody></table>
      <div class="tot">
        <p>Total : <b>${Number(f.total_fcfa).toLocaleString("fr-FR")} FCFA</b></p>
        ${f.insurer_name ? `<p style="color:#3730a3">Part assureur (${f.insurer_rate} %) : <b>${Number(f.insurer_share_fcfa || 0).toLocaleString("fr-FR")} FCFA</b> — statut : ${f.insurer_status === "reglee" ? "✅ Réglée" : "⏳ À réclamer"}</p>
        <p>Part patient : <b>${(Number(f.total_fcfa) - Number(f.insurer_share_fcfa || 0)).toLocaleString("fr-FR")} FCFA</b></p>` : ""}
        <p>Déjà payé par le patient : ${Number(f.paid_fcfa).toLocaleString("fr-FR")} FCFA</p>
        <p>Reste à charge du patient : <b>${reste.toLocaleString("fr-FR")} FCFA</b>
          <span class="badge ${f.status === "paid" ? "ok" : f.status === "partial" ? "pa" : "ko"}">${STATUS_LABELS[f.status]}</span></p>
        ${f.method ? `<p style="font-size:13px;color:#555">Mode : ${METHOD_LABELS[f.method] || f.method}</p>` : ""}
      </div>
      <div class="foot">Document généré par SantéOnline — ${new Date().toLocaleString("fr-FR")}. Merci de votre confiance 🙏</div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    w.document.close();
  };

  /* 📄 FEUILLE DE SOINS officielle (V2.7) — le document envoyé à l'INAM / SUNU…
     pour remboursement de la part assureur. Format tiers payant togolais. */
  const printCareSheet = async (id: number) => {
    const r = await fetch(`/api/invoices/${id}`);
    if (!r.ok) return flashErr(r);
    const { invoice: f, items: lignes } = await r.json();
    if (!f.care_sheet_number) return;
    const partPatient = Number(f.total_fcfa) - Number(f.insurer_share_fcfa || 0);
    const lignesHtml = (lignes as { kind: string; label: string; qty: number; unit_price_fcfa: number; total_fcfa: number }[])
      .map((l) => `<tr>
        <td>${KIND_LABELS[l.kind] || l.kind}</td><td>${l.label}</td>
        <td style="text-align:center">${l.qty}</td>
        <td style="text-align:right">${l.unit_price_fcfa.toLocaleString("fr-FR")}</td>
        <td style="text-align:right">${l.total_fcfa.toLocaleString("fr-FR")}</td>
      </tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Feuille de soins ${f.care_sheet_number}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:28px;color:#111}
        .head{display:flex;justify-content:space-between;border-bottom:3px solid #3730a3;padding-bottom:10px}
        h1{font-size:20px;text-align:center;letter-spacing:2px;margin:18px 0 2px;text-decoration:underline}
        .num{text-align:center;font-size:13px;color:#3730a3;font-weight:bold}
        .box{border:1px solid #555;padding:10px 12px;margin-top:14px;font-size:13px;line-height:1.6}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #333;padding:7px 9px;font-size:13px}
        th{background:#eef2ff}
        .sig{display:flex;justify-content:space-between;margin-top:44px;font-size:13px}
        .sig div{width:45%;border-top:1px solid #333;padding-top:6px;text-align:center;height:64px}
        .foot{margin-top:26px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:8px}
      </style></head><body>
      <div class="head">
        <div><b style="color:#3730a3;font-size:18px">🛡️ SANTÉONLINE — FEUILLE DE SOINS</b>
          <div style="font-size:12px;color:#555">${f.facility_name || ""}<br>${f.facility_address || ""} ${f.facility_phone ? "· " + f.facility_phone : ""}</div></div>
        <div style="text-align:right;font-size:13px">Assureur : <b>${f.insurer_name || ""}</b><br>
          Taux de prise en charge : <b>${f.insurer_rate} %</b></div>
      </div>
      <h1>FEUILLE DE SOINS N° ${f.care_sheet_number}</h1>
      <p class="num">Facture liée : ${f.number} · ${new Date(f.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}</p>
      <div class="box">
        <b>Assuré(e) :</b> ${f.patient_name || "—"} ${f.record_number ? `(dossier ${f.record_number})` : ""}<br>
        <b>N° d'assuré :</b> ${f.insured_number || "……………………"}<br>
        <b>Soins dispensés le :</b> ${new Date(f.created_at).toLocaleDateString("fr-FR")}
      </div>
      <table><thead><tr><th>Nature</th><th>Soin / prestation</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>${lignesHtml}</tbody></table>
      <table style="margin-top:0;border-top:none">
        <tr><td style="width:70%;text-align:right;border:none"><b>Total des soins</b></td><td style="text-align:right"><b>${Number(f.total_fcfa).toLocaleString("fr-FR")} FCFA</b></td></tr>
        <tr style="background:#eef2ff"><td style="text-align:right;border:none"><b>Part ASSUREUR à rembourser (${f.insurer_rate} %)</b></td><td style="text-align:right"><b style="color:#3730a3">${Number(f.insurer_share_fcfa || 0).toLocaleString("fr-FR")} FCFA</b></td></tr>
        <tr><td style="text-align:right;border:none">Part patient (${100 - Number(f.insurer_rate || 80)} %)</td><td style="text-align:right">${partPatient.toLocaleString("fr-FR")} FCFA</td></tr>
      </table>
      <div class="sig">
        <div>Cachet &amp; visa du prestataire</div>
        <div>Signature de l'assuré(e)</div>
      </div>
      <div class="foot">Document généré électroniquement par SantéOnline le ${new Date().toLocaleString("fr-FR")} — toute falsification est passible de poursuites. Vérification : référence ${f.care_sheet_number} auprès de l'établissement émetteur.</div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    w.document.close();
  };

  const exportCsv = () => {
    const head = "Date;N°;Patient;Total FCFA;Payé FCFA;Reste FCFA;Statut;Mode";
    const lines = items.map((i) => [
      new Date(i.created_at).toLocaleDateString("fr-FR"), i.number,
      (i.patient_name || "").replace(/;/g, ","),
      i.total_fcfa, i.paid_fcfa, i.total_fcfa - i.paid_fcfa,
      STATUS_LABELS[i.status] || i.status, i.method ? METHOD_LABELS[i.method] : "",
    ].join(";"));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `facturation_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="text-emerald-600" /> Facturation & paiements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Factures patients, encaissements T-Money / Flooz / espèces et rapport exportable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInsurers(true)}
            title="Gérer les assureurs et leurs taux"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-semibold text-sm"
          >
            🛡️ Assureurs
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow"
          >
            <Plus size={16} /> Nouvelle facture
          </button>
        </div>
      </div>

      {/* Onglets : Factures / Bordereau assureurs */}
      <div className="flex gap-2">
        <button onClick={() => setView("factures")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view === "factures" ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300"}`}>
          🧾 Factures
        </button>
        <button onClick={() => setView("bordereau")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view === "bordereau" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
          🛡️ Bordereau assureurs
        </button>
      </div>

      {msg && <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">{msg}</div>}
      {err && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">{err}</div>}

      {/* Statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total facturé</p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1">{fmt(stats.billed)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Encaissé</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">{fmt(stats.collected)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Dû par patients</p>
          <p className="text-xl sm:text-2xl font-extrabold text-red-600 mt-1">{fmt(stats.outstanding)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">🛡️ Dû par assureurs</p>
          <p className="text-xl sm:text-2xl font-extrabold text-indigo-700 mt-1">{fmt((stats as { insurer_due?: number }).insurer_due || 0)}</p>
        </div>
      </div>

      {view === "factures" && (<>
      {/* Filtres façon rapport */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Statut</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm">
            <option value="all">Tous</option>
            <option value="unpaid">Non payées</option>
            <option value="partial">Partielles</option>
            <option value="paid">Payées</option>
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-bold text-gray-500 mb-1">Recherche</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Patient ou n° de facture…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm" />
          </div>
        </div>
        <button onClick={exportCsv} disabled={items.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-black disabled:opacity-40 text-white rounded-xl text-sm font-semibold">
          <Download size={15} /> Exporter (CSV)
        </button>
      </div>

      {/* Tableau rapport */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">N°</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Payé</th>
                <th className="py-3 px-4 text-right">Reste</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">
                  Aucune facture sur cette période. Clique sur « Nouvelle facture » pour commencer 🚀
                </td></tr>
              )}
              {items.map((i) => (
                <tr key={i.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="py-3 px-4 text-gray-600">
                    {new Date(i.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-gray-800">{i.number}</td>
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {i.patient_name || "—"}
                    {i.insurer_name && (
                      <span className="block text-[10px] font-bold text-indigo-600 mt-0.5">
                        🛡️ {i.insurer_name}{i.care_sheet_number ? ` · ${i.care_sheet_number}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">{fmt(i.total_fcfa)}</td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-semibold">{fmt(i.paid_fcfa)}</td>
                  <td className="py-3 px-4 text-right text-red-600 font-semibold">
                    {fmt(i.total_fcfa - (i.insurer_share_fcfa || 0) - i.paid_fcfa)}
                    {Number(i.insurer_share_fcfa || 0) > 0 && (
                      <span className="block text-[10px] font-bold text-indigo-500">
                        assureur : {i.insurer_status === "reglee" ? "✅" : "⏳"} {fmt(i.insurer_share_fcfa || 0)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[i.status]}`}>
                      {STATUS_LABELS[i.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {i.status !== "paid" && (
                        <button onClick={() => { setPayFor(i); setPayAmount(String(i.total_fcfa - (i.insurer_share_fcfa || 0) - i.paid_fcfa)); }}
                          title="Encaisser un paiement (part patient)"
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                          <Banknote size={15} />
                        </button>
                      )}
                      {i.care_sheet_number && (
                        <button onClick={() => printCareSheet(i.id)} title="Imprimer la feuille de soins (pour l'assureur)"
                          className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold">
                          📄
                        </button>
                      )}
                      {i.insurer_status === "a_reclamer" && (
                        <button onClick={() => settleInsurer(i)} title="L'assureur a payé sa part"
                          className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100">
                          🤝
                        </button>
                      )}
                      <button onClick={() => printInvoice(i.id)} title="Imprimer la facture"
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                        <Printer size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      {/* ===== 🛡️ VUE BORDEREAU ASSUREURS (V2.7) ===== */}
      {view === "bordereau" && (
        <div className="space-y-5">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-bold text-indigo-700 mb-1">Mois du bordereau</label>
              <input type="month" value={bMonth} onChange={(e) => setBMonth(e.target.value)}
                className="px-3 py-2 border border-indigo-200 rounded-xl text-sm bg-white" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-indigo-600 font-semibold">TOTAL À RÉCLAMER</p>
              <p className="text-2xl font-extrabold text-indigo-800">{fmt(grandPending)}</p>
              <p className="text-[11px] text-indigo-400">déjà remboursé ce mois : {fmt(grandTotal - grandPending)}</p>
            </div>
          </div>

          {bordereau.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
              Aucune feuille de soins ce mois-ci. Les factures « assurées » apparaîtront ici automatiquement. 🛡️
            </div>
          )}

          {bordereau.map((g) => (
            <div key={g.insurerId} className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-indigo-600 text-white flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">🛡️ {g.insurerName}</p>
                  <p className="text-[11px] text-indigo-200">Taux : {g.rate} % pris en charge{g.phone ? ` · ${g.phone}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-indigo-200">À réclamer</p>
                  <p className="text-lg font-extrabold">{fmt(g.pending)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                      <th className="py-2.5 px-4">Feuille de soins</th>
                      <th className="py-2.5 px-4">Facture</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Patient</th>
                      <th className="py-2.5 px-4 text-right">Part assureur</th>
                      <th className="py-2.5 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 px-4 font-mono text-xs font-bold text-indigo-700">{l.careSheet || "—"}</td>
                        <td className="py-2.5 px-4 font-mono text-xs">{l.number}</td>
                        <td className="py-2.5 px-4 text-gray-600">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                        <td className="py-2.5 px-4">{l.patientName || "—"}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-indigo-700">{fmt(l.insurerShare)}</td>
                        <td className="py-2.5 px-4">
                          {l.settled
                            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ Réglé</span>
                            : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ À réclamer</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Modale : nouvelle facture ===== */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Wallet size={20} className="text-emerald-600" /> Nouvelle facture
              </h2>
              <button onClick={() => setShowNew(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Patient *</label>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm">
                <option value="">— Choisir un patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}{p.recordNumber ? ` (${p.recordNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 🛡️ TIERS PAYANT (facultatif) */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-indigo-700">🛡️ Patient assuré ? (tiers payant)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={insurerId} onChange={(e) => setInsurerId(e.target.value)}
                  className="px-3 py-2 border border-indigo-200 rounded-xl text-sm bg-white">
                  <option value="">— Assurant lui-même (paye 100 %) —</option>
                  {insurers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.rate} %)</option>
                  ))}
                </select>
                <input placeholder="N° d'assuré (ex : carte AMU-INAM)" value={insuredNumber}
                  onChange={(e) => setInsuredNumber(e.target.value)}
                  className="px-3 py-2 border border-indigo-200 rounded-xl text-sm bg-white" />
              </div>
              {insurerId && (
                <p className="text-xs text-indigo-700 font-medium">
                  ➜ L'assureur paiera <b>{fmt(insurerDraftShare)}</b>, le patient paiera seulement{" "}
                  <b>{fmt(totalDraft - insurerDraftShare)}</b>. Une feuille de soins FS sera générée.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500">Lignes de la facture *</label>
              {rows.map((r, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <select value={r.kind} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, kind: e.target.value } : x))}
                    className="px-2 py-2 border border-gray-300 rounded-xl text-sm w-32">
                    {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input placeholder="Libellé (ex : Consultation générale)" value={r.label}
                    onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                    className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                  <input type="number" min="1" placeholder="Qté" value={r.qty}
                    onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))}
                    className="w-16 px-2 py-2 border border-gray-300 rounded-xl text-sm text-center" />
                  <input type="number" min="0" placeholder="Prix FCFA" value={r.unitPrice}
                    onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value } : x))}
                    className="w-28 px-2 py-2 border border-gray-300 rounded-xl text-sm text-right" />
                  <button onClick={() => setRows(rows.filter((_, i) => i !== idx))} disabled={rows.length === 1}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button onClick={() => setRows([...rows, { kind: "service", label: "", qty: "1", unitPrice: "" }])}
                className="text-sm text-emerald-700 font-semibold hover:underline">
                + Ajouter une ligne
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Remise (FCFA)</label>
                <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
              </div>
              <div className="flex items-end justify-end">
                <p className="text-lg font-extrabold text-gray-900">
                  Total : <span className="text-emerald-700">{fmt(totalDraft)}</span>
                </p>
              </div>
            </div>
            <input placeholder="Note facultative (ex : prise en charge assurance)"
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />

            <button onClick={createInvoice}
              disabled={busy || !patientId || rows.every((r) => !r.label.trim())}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm">
              {busy ? "Création…" : `Créer la facture — ${fmt(totalDraft)}`}
            </button>
          </div>
        </div>
      )}

      {/* ===== 🛡️ Modale : gestion des assureurs (taux réglables) ===== */}
      {showInsurers && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">🛡️ Assureurs maladie du Togo</h2>
              <button onClick={() => setShowInsurers(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500">
              Taux = part payée par l'assureur. Exemple : <b>80 %</b> → sur une consultation de 5 000 FCFA,
              l'assureur rembourse 4 000 F, le patient ne paie que 1 000 F.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {insurers.map((s) => (
                <div key={s.id} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm font-medium text-gray-800">{s.name}</span>
                  <input type="number" min="0" max="100" defaultValue={s.rate}
                    className="w-20 px-2 py-1.5 border border-indigo-200 rounded-lg text-sm text-right bg-white"
                    onBlur={async (e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v !== s.rate) {
                        await fetch("/api/insurers", {
                          method: "PUT", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: s.id, rate: v }),
                        });
                        setInsurers(insurers.map((x) => x.id === s.id ? { ...x, rate: v } : x));
                        flash("✅ Taux mis à jour.");
                      }
                    }} />
                  <span className="text-sm font-bold text-indigo-600">%</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-bold text-gray-500">➕ Ajouter un assureur</p>
              <input placeholder="Nom (ex : Ogar, mutuelle de quartier…)" value={newInsurer.name}
                onChange={(e) => setNewInsurer({ ...newInsurer, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
              <div className="flex gap-2">
                <input type="number" min="0" max="100" placeholder="Taux %" value={newInsurer.rate}
                  onChange={(e) => setNewInsurer({ ...newInsurer, rate: e.target.value })}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                <input placeholder="Téléphone (facultatif)" value={newInsurer.phone}
                  onChange={(e) => setNewInsurer({ ...newInsurer, phone: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                <button
                  onClick={async () => {
                    const r = await fetch("/api/insurers", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newInsurer.name, rate: newInsurer.rate, phone: newInsurer.phone }),
                    });
                    if (r.ok) {
                      setNewInsurer({ name: "", rate: "80", phone: "" });
                      fetch("/api/insurers").then((x) => x.json()).then((d) => setInsurers(d.items || []));
                      flash("🛡️ Assureur ajouté.");
                    } else flashErr(r);
                  }}
                  disabled={!newInsurer.name.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modale : encaissement ===== */}
      {payFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Banknote size={20} className="text-emerald-600" /> Encaisser
            </h2>
            <p className="text-sm text-gray-600">
              <b>{payFor.number}</b> — {payFor.patient_name}<br />
              Reste à payer par <b>le patient</b> : <b className="text-red-600">{fmt(payFor.total_fcfa - (payFor.insurer_share_fcfa || 0) - payFor.paid_fcfa)}</b>
              {payFor.insurer_name && (
                <span className="block text-xs text-indigo-600 mt-1">
                  🛡️ {payFor.insurer_name} couvre {fmt(payFor.insurer_share_fcfa || 0)} ({payFor.insurer_rate} %)
                </span>
              )}
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Montant reçu (FCFA)</label>
              <input type="number" min="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Mode de paiement</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(METHOD_LABELS).map(([v, l]) => (
                  <button key={v} onClick={() => setPayMethod(v)}
                    className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                      payMethod === v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}>
                    {v === "tmoney" ? "💛 " : v === "flooz" ? "💙 " : v === "cash" ? "💵 " : "💳 "}{l}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                💡 Le patient paie par T-Money/Flooz au numéro de la caisse, tu confirmes ici dès
                réception — le patient est notifié automatiquement.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPayFor(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600">
                Annuler
              </button>
              <button onClick={pay} disabled={!(parseInt(payAmount) > 0)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold">
                Valider l'encaissement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
