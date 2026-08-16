"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import {
  FileText, Search, Loader2, Plus, Printer, Stethoscope, Pill, FlaskConical,
  ClipboardList, X, ChevronLeft, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import RxInsuranceBanner, { RxInsChoice } from "@/components/RxInsuranceBanner";

/* ================================ TYPES ================================ */
interface PatientLite {
  id: number;
  fullName: string;
  recordNumber?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
}
interface Consultation {
  id: number; motif: string; symptoms: string | null; temperature: number | null;
  bloodPressure: string | null; pulse: number | null; weight: number | null; height: number | null;
  saturation: number | null; observations: string | null; diagnosis: string | null;
  treatment: string | null; prescription: string | null; examsRequested: string | null;
  recommendations: string | null; nextAppointmentAt: string | null;
  createdAt: string; doctorName: string | null;
}
interface OrdoItem { medication: string; dosage?: string; posology?: string; frequency?: string; duration?: string; instructions?: string; }
interface Ordonnance {
  id: number; consultationId: number | null; instructions: string | null;
  createdAt: string; doctorName: string | null; items: OrdoItem[];
}
interface DmeExam { kind: "labo" | "imagerie"; id: number; exam_type: string; status: string; result: string | null; created_at: string; validated_at: string | null; }
interface Condition { id: number; name: string; icd_code: string | null; diagnosed_year: number | null; status: string; notes: string | null; }
interface Medication { id: number; name: string; dosage: string | null; posology: string | null; frequency: string | null; since: string | null; active: boolean; notes: string | null; }
interface Allergy { id: number; substance: string; reaction: string | null; severity: string | null; }
interface FamilyEntry { id: number; relative: string; condition: string; notes: string | null; }
interface Contra { id: number; item: string; notes: string | null; }
interface Metric { id: number; metric: string; value: number | null; value2: number | null; unit: string | null; taken_at: string; source: string; }
interface JournalEntry { id: number; entry_date: string; mood: number | null; symptoms: string | null; note: string | null; }
interface DocMeta { id: number; kind: string; title: string; mime: string; size_bytes: number; created_at: string; uploaded_by_name?: string | null; }
interface Dme {
  patient: { id: number; recordNumber: string | null; fullName: string; dateOfBirth: string | null; gender: string | null; bloodType: string | null; medicalNotes: string | null; insurerName: string | null; insuredNumber?: string | null; coverageStatus: string | null; };
  professional: { facilityName: string | null; facilityType: string | null; facilityAddress: string | null; facilityCity: string | null; lastDoctor: string | null; };
  consultations: Consultation[];
  ordonnances: Ordonnance[];
  exams: DmeExam[];
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  socialHistory: { tobacco: string | null; alcohol: string | null; activity: string | null; notes: string | null } | null;
  familyHistory: FamilyEntry[];
  contraindications: Contra[];
  metrics: Metric[];
  journal: JournalEntry[];
}

const METRIC_LABEL: Record<string, string> = {
  poids: "⚖️ Poids", glycemie: "🩸 Glycémie", tension: "🩺 Tension", temperature: "🌡️ Température",
  pouls: "💓 Pouls", spo2: "🫁 SpO₂", douleur: "😣 Douleur", sommeil: "😴 Sommeil",
};
const MOOD_EMOJI: Record<number, string> = { 1: "😫", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

const fcfa = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: fr }) : "—";
const ageOf = (dob: string | null) => {
  if (!dob) return "—";
  const a = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(a) && a >= 0 ? `${a} ans` : "—";
};
const STATUS_EX: Record<string, { label: string; cls: string }> = {
  requested: { label: "🟡 Demandé", cls: "bg-amber-100 text-amber-800" },
  in_progress: { label: "🔵 En cours", cls: "bg-sky-100 text-sky-800" },
  completed: { label: "🟢 Terminé", cls: "bg-teal-100 text-teal-800" },
  validated: { label: "✅ Validé", cls: "bg-emerald-100 text-emerald-800" },
};

const emptyConsult = {
  motif: "", symptoms: "", temperature: "", bloodPressure: "", pulse: "",
  weight: "", height: "", saturation: "", observations: "", diagnosis: "",
  treatment: "", examsRequested: "", recommendations: "", nextAppointmentAt: "",
};
const emptyItem: OrdoItem = { medication: "", dosage: "", posology: "", frequency: "", duration: "", instructions: "" };

/* ================================ PAGE ================================ */
export default function RecordsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "doctor";
  const allowed = ["admin", "doctor", "nurse"].includes(user?.role || "");

  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dme, setDme] = useState<Dme | null>(null);
  const [loadingDme, setLoadingDme] = useState(false);
  const [tab, setTab] = useState<"aapercu" | "consultations" | "ordonnances" | "examens" | "sante" | "journal" | "rapports">("aapercu");

  const [showConsultForm, setShowConsultForm] = useState(false);
  const [consult, setConsult] = useState({ ...emptyConsult });
  const [showOrdoForm, setShowOrdoForm] = useState(false);
  const [ordoItems, setOrdoItems] = useState<OrdoItem[]>([{ ...emptyItem }]);
  const [ordoInstructions, setOrdoInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  /* 🛡️ V2.9 — assurance choisie pour l'ordonnance en cours
     (primaire par défaut, modifiable via le bandeau) */
  const [rxIns, setRxIns] = useState<RxInsChoice | null>(null);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => setPatients(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadDme = useCallback(async (pid: number) => {
    setLoadingDme(true);
    setDme(null);
    try {
      const res = await fetch(`/api/patients/${pid}/dme`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de charger le dossier");
      setDme(data);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setLoadingDme(false);
    }
  }, []);

  const pick = (p: PatientLite) => {
    setSelectedId(p.id);
    setTab("aapercu");
    setShowConsultForm(false);
    setShowOrdoForm(false);
    setFormError("");
    loadDme(p.id);
  };

  /* Mutations profil de santé (V2.4) */
  const sante = async (kind: string, op: "add" | "del", payload: Record<string, unknown>) => {
    if (!selectedId) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`/api/patients/${selectedId}/sante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, op, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      await loadDme(selectedId);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveConsultation = async () => {
    setFormError("");
    if (!consult.motif.trim()) { setFormError("Le motif est obligatoire."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${selectedId}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(consult),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");
      setConsult({ ...emptyConsult });
      setShowConsultForm(false);
      setTab("consultations");
      if (selectedId) loadDme(selectedId);
    } catch (e) { setFormError((e as Error).message); } finally { setSaving(false); }
  };

  const saveOrdonnance = async () => {
    setFormError("");
    const items = ordoItems.filter((i) => i.medication.trim());
    if (items.length === 0) { setFormError("Ajoute au moins un médicament."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${selectedId}/ordonnances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: ordoInstructions, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");
      setOrdoItems([{ ...emptyItem }]);
      setOrdoInstructions("");
      setShowOrdoForm(false);
      setTab("ordonnances");
      if (selectedId) loadDme(selectedId);
    } catch (e) { setFormError((e as Error).message); } finally { setSaving(false); }
  };

  /* Impression ordonnance avec EN-TÊTE PROFESSIONNELLE */
  const printOrdonnance = (o: Ordonnance) => {
    if (!dme) return;
    const esc = (s: string | null | undefined) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const RX_STATUS_LABEL: Record<string, string> = { actif: "Actif", expire: "Expiré", suspendu: "Suspendu", inconnu: "Inconnu" };
    const prof = dme.professional;
    const rows = o.items.map((i, k) => `
      <tr><td>${k + 1}</td><td><b>${esc(i.medication)}</b></td><td>${esc(i.dosage)}</td><td>${esc(i.posology)}</td><td>${esc(i.frequency)}</td><td>${esc(i.duration)}</td></tr>`).join("");
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ordonnance — ${esc(dme.patient.fullName)}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:36px;color:#111;max-width:720px}
        .head{display:flex;justify-content:space-between;border-bottom:3px solid #047857;padding-bottom:10px}
        .brand{color:#047857;font-size:20px;font-weight:bold}
        .pro{font-size:11px;color:#444;text-align:right;line-height:1.5}
        h1{text-align:center;font-size:22px;letter-spacing:2px;margin:24px 0 4px;text-decoration:underline}
        .pat{font-size:14px;margin:10px 0}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
        th,td{border:1px solid #9ca3af;padding:7px 8px;text-align:left;vertical-align:top}
        th{background:#ecfdf5;color:#065f46}
        .instr{margin-top:14px;font-size:13px;background:#f9fafb;border-left:4px solid #059669;padding:10px}
        .sign{margin-top:46px;display:flex;justify-content:space-between;font-size:13px}
        .foot{margin-top:30px;font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:8px}
      </style></head><body>
      <div class="head">
        <div><span class="brand">🩺 SantéOnline</span><div class="pro" style="text-align:left">${esc(prof.facilityName) || "Cabinet médical"} — ${esc(prof.facilityType) || ""}</div></div>
        <div class="pro">
          ${esc(prof.facilityAddress) || ""}${prof.facilityAddress ? "<br/>" : ""}${esc(prof.facilityCity) || ""}<br/>
          ${o.doctorName ? `Dr ${esc(o.doctorName)}` : ""}<br/>WhatsApp : +228 71 69 24 01
        </div>
      </div>
      <h1>ORDONNANCE</h1>
      <div class="pat">Patient(e) : <b>${esc(dme.patient.fullName)}</b> · ${ageOf(dme.patient.dateOfBirth)}${dme.patient.recordNumber ? ` · N° ${esc(dme.patient.recordNumber)}` : ""}<br/>
      ${rxIns ? `Assurance : <b>🛡️ ${esc(rxIns.label)}</b>${rxIns.number ? ` · N° assuré : <b>${esc(rxIns.number)}</b>` : ""} · Statut : ${esc(RX_STATUS_LABEL[rxIns.status] || rxIns.status)}<br/>` : dme.patient.insurerName ? `Assurance : <b>🛡️ ${esc(dme.patient.insurerName)}</b>${dme.patient.insuredNumber ? ` · N° assuré : <b>${esc(dme.patient.insuredNumber)}</b>` : ""}${dme.patient.coverageStatus ? ` · Couverture : ${esc(dme.patient.coverageStatus)}` : ""}<br/>` : ""}
      Date : ${format(new Date(o.createdAt), "dd MMMM yyyy", { locale: fr })}</div>
      <table><thead><tr><th>#</th><th>Médicament</th><th>Dosage</th><th>Posologie</th><th>Fréquence</th><th>Durée</th></tr></thead><tbody>${rows}</tbody></table>
      ${o.items.some((i) => i.instructions) ? `<div class="instr">${o.items.filter((i) => i.instructions).map((i) => `• <b>${esc(i.medication)}</b> : ${esc(i.instructions)}`).join("<br/>")}</div>` : ""}
      ${o.instructions ? `<div class="instr"><b>Instructions générales :</b> ${esc(o.instructions)}</div>` : ""}
      <div class="sign"><span></span><span>Signature &amp; cachet du médecin</span></div>
      <div class="foot">Document médical nominatif — généré par SantéOnline. Jusqu'à la fin du traitement, toute modification passe par le médecin prescripteur.</div>
      <script>window.onload=function(){window.print();};<\/script></body></html>`);
    w.document.close();
  };

  const filteredPatients = patients.filter((p) =>
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (p.recordNumber || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!allowed) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-8 text-center max-w-lg mx-auto mt-10">
        <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Le dossier médical est réservé au <b>personnel médical</b>.</p>
      </div>
    );
  }

  /* ---------- SÉLECTION DU PATIENT ---------- */
  if (!selectedId) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Dossiers médicaux</h1>
          <p className="text-sm text-gray-500">Sémiologie complète, examens, ordonnances — tout le parcours clinique du patient, en un seul endroit.</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un patient (nom ou N° de dossier)…"
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        <div className="space-y-2">
          {filteredPatients.slice(0, 20).map((p) => (
            <button key={p.id} onClick={() => pick(p)} className="w-full bg-white border border-gray-100 hover:border-emerald-300 hover:shadow-md rounded-2xl p-4 flex items-center gap-3 text-left transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                {p.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.fullName}</p>
                <p className="text-xs text-gray-500">{p.recordNumber || ""} · {ageOf(p.dateOfBirth || null)}</p>
              </div>
              <FileText size={18} className="text-emerald-600 shrink-0" />
            </button>
          ))}
          {filteredPatients.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Aucun patient trouvé.</p>}
        </div>
      </div>
    );
  }

  /* ---------- DOSSIER OUVERT ---------- */
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <button onClick={() => { setSelectedId(null); setDme(null); }} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-700">
        <ChevronLeft size={16} /> Choisir un autre patient
      </button>

      {loadingDme && <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto my-10" />}
      {formError && !dme && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{formError}</div>
      )}

      {dme && (
        <>
          {/* En-tête patient + coordonnées professionnelles */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 rounded-2xl p-6 text-white">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">{dme.patient.fullName}</h1>
                <p className="text-emerald-100 text-sm mt-1">
                  {dme.patient.recordNumber || "—"} · {ageOf(dme.patient.dateOfBirth)} · {dme.patient.gender === "male" ? "Homme" : dme.patient.gender === "female" ? "Femme" : "—"}
                  {dme.patient.bloodType ? ` · Groupe ${dme.patient.bloodType}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-emerald-100 leading-relaxed">
                <p className="font-bold text-white">🏥 {dme.professional.facilityName || "Cabinet"}</p>
                <p>{[dme.professional.facilityAddress, dme.professional.facilityCity].filter(Boolean).join(", ")}</p>
                {dme.professional.lastDoctor && <p>Dr {dme.professional.lastDoctor}</p>}
              </div>
            </div>
          </div>

          {dme.patient.medicalNotes && (
            <div className="bg-red-50 border-l-4 border-red-400 rounded-xl p-4">
              <p className="text-xs font-bold text-red-700 uppercase">⚠️ Antécédents / allergies</p>
              <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{dme.patient.medicalNotes}</p>
            </div>
          )}

          {/* Onglets */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              ["aapercu", "📋 Aperçu", ClipboardList],
              ["consultations", `🩺 Consultations (${dme.consultations.length})`, Stethoscope],
              ["ordonnances", `💊 Ordonnances (${dme.ordonnances.length})`, Pill],
              ["examens", `🧪 Examens (${dme.exams.length})`, FlaskConical],
              ["sante", `🧬 Profil santé (${dme.conditions.length + dme.allergies.length})`, ClipboardList],
              ["journal", `📝 Journal & suivi (${dme.journal.length})`, ClipboardList],
              ["rapports", "🗂️ Rapports", ClipboardList],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold ${tab === key ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ================= APERÇU ================= */}
          {tab === "aapercu" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3">🗺️ Parcours clinique (jusqu'à la fin des traitements)</h3>
                <ol className="relative border-l-2 border-emerald-200 ml-2 space-y-4">
                  {[
                    ...dme.consultations.slice(0, 3).map((c) => ({
                      date: c.createdAt,
                      title: `🩺 Consultation — ${c.motif}`,
                      sub: c.diagnosis ? `Diagnostic : ${c.diagnosis}` : "En cours…",
                    })),
                    ...dme.exams.slice(0, 3).map((e) => ({
                      date: e.created_at,
                      title: `🧪 ${e.exam_type}`,
                      sub: (STATUS_EX[e.status] || STATUS_EX.requested).label,
                    })),
                    ...dme.ordonnances.slice(0, 3).map((o) => ({
                      date: o.createdAt,
                      title: `💊 Ordonnance #${o.id}`,
                      sub: `${o.items.length} médicament${o.items.length > 1 ? "s" : ""}${o.doctorName ? " · Dr " + o.doctorName : ""}`,
                    })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 8)
                    .map((ev, i) => (
                      <li key={i} className="ml-4">
                        <span className="absolute -left-[7px] mt-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                        <p className="text-sm font-semibold text-gray-900">{ev.title}</p>
                        <p className="text-xs text-gray-500">{ev.sub} · {fcfa(ev.date)}</p>
                      </li>
                    ))}
                </ol>
                {dme.consultations.length === 0 && dme.exams.length === 0 && dme.ordonnances.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Dossier vierge — commence par une consultation.</p>
                )}
              </div>
              {canWrite && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <button onClick={() => { setShowConsultForm(true); setShowOrdoForm(false); setTab("consultations"); }} className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm">
                    🩺 Nouvelle consultation
                  </button>
                  <button onClick={() => { setShowOrdoForm(true); setShowConsultForm(false); setTab("ordonnances"); }} className="py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-sm">
                    💊 Nouvelle ordonnance
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= CONSULTATIONS ================= */}
          {tab === "consultations" && (
            <div className="space-y-4">
              {canWrite && (
                <button onClick={() => setShowConsultForm((s) => !s)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm">
                  <Plus size={16} /> {showConsultForm ? "Fermer le formulaire" : "Nouvelle consultation"}
                </button>
              )}

              {showConsultForm && canWrite && (
                <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 space-y-4">
                  <h3 className="font-bold text-gray-900">🩺 Consultation — sémiologie complète</h3>
                  <div>
                    <label className="text-xs font-bold text-gray-600">1. Motif de consultation *</label>
                    <input value={consult.motif} onChange={(e) => setConsult({ ...consult, motif: e.target.value })} placeholder="Ex. : fièvre depuis 3 jours" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600">2. Symptômes déclarés</label>
                    <textarea value={consult.symptoms} onChange={(e) => setConsult({ ...consult, symptoms: e.target.value })} rows={2} placeholder="Céphalées, frissons, nausées…" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-1">3. Constantes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {([
                        ["temperature", "🌡️ Température °C"],
                        ["bloodPressure", "🩺 Tension (12/8)"],
                        ["pulse", "💓 Pouls /min"],
                        ["weight", "⚖️ Poids kg"],
                        ["height", "📏 Taille cm"],
                        ["saturation", "🫁 SpO₂ %"],
                      ] as const).map(([k, label]) => (
                        <input
                          key={k}
                          value={consult[k]}
                          onChange={(e) => setConsult({ ...consult, [k]: e.target.value })}
                          placeholder={label}
                          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      ))}
                    </div>
                  </div>
                  {([
                    ["observations", "4. Observations cliniques (examen physique)"],
                    ["diagnosis", "5. 🧠 Diagnostic retenu"],
                    ["treatment", "6. Traitement prescrit / conduite tenue"],
                    ["examsRequested", "7. Examens complémentaires demandés"],
                    ["recommendations", "8. Recommandations au patient"],
                  ] as const).map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-bold text-gray-600">{label}</label>
                      <textarea value={consult[k]} onChange={(e) => setConsult({ ...consult, [k]: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-bold text-gray-600">9. 📅 Prochain rendez-vous (fin de traitement / contrôle)</label>
                    <input type="datetime-local" value={consult.nextAppointmentAt} onChange={(e) => setConsult({ ...consult, nextAppointmentAt: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  {formError && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{formError}</div>}
                  <button onClick={saveConsultation} disabled={saving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : "💾 Enregistrer la consultation (signée Dr " + (user?.fullName || "") + ")"}
                  </button>
                </div>
              )}

              {dme.consultations.length === 0 && !showConsultForm && (
                <p className="text-sm text-gray-400 text-center py-8">Aucune consultation enregistrée pour ce patient.</p>
              )}
              {dme.consultations.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-900">🩺 {c.motif}</p>
                    <p className="text-xs text-gray-400">{format(new Date(c.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}{c.doctorName ? ` · Dr ${c.doctorName}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.temperature !== null && <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">🌡️ {c.temperature} °C</span>}
                    {c.bloodPressure && <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">🩺 TA {c.bloodPressure}</span>}
                    {c.pulse !== null && <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">💓 {c.pulse}/min</span>}
                    {c.weight !== null && <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">⚖️ {c.weight} kg</span>}
                    {c.saturation !== null && <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">🫁 SpO₂ {c.saturation} %</span>}
                  </div>
                  {c.symptoms && <p className="text-sm text-gray-700"><b className="text-gray-500 text-xs uppercase">Symptômes : </b>{c.symptoms}</p>}
                  {c.observations && <p className="text-sm text-gray-700"><b className="text-gray-500 text-xs uppercase">Observations : </b>{c.observations}</p>}
                  {c.diagnosis && (
                    <p className="text-sm bg-sky-50 border border-sky-100 rounded-xl p-3"><b className="text-sky-800">🧠 Diagnostic : </b>{c.diagnosis}</p>
                  )}
                  {c.treatment && <p className="text-sm text-gray-700"><b className="text-gray-500 text-xs uppercase">💊 Traitement : </b>{c.treatment}</p>}
                  {c.examsRequested && <p className="text-sm text-gray-700"><b className="text-gray-500 text-xs uppercase">🧪 Examens demandés : </b>{c.examsRequested}</p>}
                  {c.recommendations && <p className="text-sm text-gray-700"><b className="text-gray-500 text-xs uppercase">📌 Recommandations : </b>{c.recommendations}</p>}
                  {c.nextAppointmentAt && (
                    <p className="text-xs text-emerald-700 font-semibold">📅 Contrôle prévu : {format(new Date(c.nextAppointmentAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ================= ORDONNANCES ================= */}
          {tab === "ordonnances" && (
            <div className="space-y-4">
              {/* 🛡️ V2.9 — Bandeau assurance : primaire par défaut,
                  choix de la couverture pour CETTE ordonnance si plusieurs,
                  « non assuré — paiement direct » sans bloquer sinon */}
              {selectedId != null && (
                <RxInsuranceBanner patientId={selectedId} onSelect={setRxIns} />
              )}
              {canWrite && (
                <button onClick={() => setShowOrdoForm((s) => !s)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-sm">
                  <Plus size={16} /> {showOrdoForm ? "Fermer" : "Nouvelle ordonnance"}
                </button>
              )}

              {showOrdoForm && canWrite && (
                <div className="bg-white rounded-2xl border-2 border-teal-200 p-5 space-y-3">
                  <h3 className="font-bold text-gray-900">💊 Ordonnance — ligne par ligne</h3>
                  {ordoItems.map((it, idx) => (
                    <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-2 relative">
                      {ordoItems.length > 1 && (
                        <button onClick={() => setOrdoItems(ordoItems.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      )}
                      <input value={it.medication} onChange={(e) => setOrdoItems(ordoItems.map((x, i) => i === idx ? { ...x, medication: e.target.value } : x))} placeholder="Médicament * (ex. Paracétamol)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["dosage", "posology", "frequency", "duration"] as const).map((k) => (
                          <input key={k} value={it[k] || ""} onChange={(e) => setOrdoItems(ordoItems.map((x, i) => i === idx ? { ...x, [k]: e.target.value } : x))} placeholder={{ dosage: "Dosage (500 mg)", posology: "Posologie (1 cp)", frequency: "Fréquence (3×/j)", duration: "Durée (5 j)" }[k]} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                        ))}
                      </div>
                      <input value={it.instructions || ""} onChange={(e) => setOrdoItems(ordoItems.map((x, i) => i === idx ? { ...x, instructions: e.target.value } : x))} placeholder="Instruction particulière (ex. : pendant les repas)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                  ))}
                  <button onClick={() => setOrdoItems([...ordoItems, { ...emptyItem }])} className="text-sm text-teal-700 font-semibold hover:underline">
                    + Ajouter un médicament
                  </button>
                  <textarea value={ordoInstructions} onChange={(e) => setOrdoInstructions(e.target.value)} rows={2} placeholder="Instructions générales (hydratation, alarmes, fin du traitement, contre-indications…)" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                  {formError && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{formError}</div>}
                  <button onClick={saveOrdonnance} disabled={saving} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : "💾 Enregistrer l'ordonnance"}
                  </button>
                </div>
              )}

              {dme.ordonnances.length === 0 && !showOrdoForm && (
                <p className="text-sm text-gray-400 text-center py-8">Aucune ordonnance pour ce patient.</p>
              )}
              {dme.ordonnances.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-900">💊 Ordonnance #{o.id}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400">{fcfa(o.createdAt)}{o.doctorName ? ` · Dr ${o.doctorName}` : ""}</p>
                      <button onClick={() => printOrdonnance(o)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">
                        <Printer size={13} /> Imprimer / PDF
                      </button>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b"><th className="py-1.5">Médicament</th><th>Dosage</th><th>Posologie</th><th>Fréquence</th><th>Durée</th></tr></thead>
                    <tbody>
                      {o.items.map((i, k) => (
                        <tr key={k} className="border-b border-gray-50">
                          <td className="py-2 font-semibold">{i.medication}</td>
                          <td>{i.dosage || "—"}</td><td>{i.posology || "—"}</td><td>{i.frequency || "—"}</td><td>{i.duration || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {o.instructions && <p className="text-xs text-gray-500">📌 {o.instructions}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ================= EXAMENS ================= */}
          {tab === "examens" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Demande, résultats et validations se gèrent depuis <b>Patients → fiche du patient → Examens</b>. Ici : lecture clinique.</p>
              {dme.exams.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Aucun examen demandé.</p>}
              {dme.exams.map((e) => {
                const st = STATUS_EX[e.status] || STATUS_EX.requested;
                return (
                  <div key={`${e.kind}-${e.id}`} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${e.kind === "labo" ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"}`}>
                        {e.kind === "labo" ? "🧪 Biologie" : "🩻 Imagerie"}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-gray-400">{fcfa(e.created_at)}</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mt-2">{e.exam_type}</p>
                    {e.result && (
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-line bg-gray-50 rounded-lg p-3">{e.result}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* ================= PROFIL SANTÉ (V2.4) ================= */}
          {tab === "sante" && (
            <div className="grid md:grid-cols-2 gap-4">
              <SanteSection
                title="Conditions de santé" icon="🩺" canWrite={canWrite}
                fields={[
                  { key: "name", label: "Condition *", ph: "Ex. : Diabète type 2" },
                  { key: "icdCode", label: "Code CIM", ph: "Ex. : 5A11" },
                  { key: "diagnosedYear", label: "Année diagnostic", ph: "2022" },
                ]}
                onAdd={(v) => sante("condition", "add", v)}
              >
                {dme.conditions.map((c) => (
                  <Row key={c.id} title={c.name + (c.icd_code ? ` (${c.icd_code})` : "")} sub={`${c.diagnosed_year || "—"} · ${c.status === "resolved" ? "guérie ✓" : "en cours"}`} onDel={canWrite ? () => sante("condition", "del", { id: c.id }) : undefined} />
                ))}
                {dme.conditions.length === 0 && <Empty text="Aucune condition déclarée." />}
              </SanteSection>

              <SanteSection
                title="Médicaments actuels" icon="💊" canWrite={canWrite}
                fields={[
                  { key: "name", label: "Médicament *", ph: "Ex. : Metformine" },
                  { key: "dosage", label: "Dosage", ph: "1000 mg" },
                  { key: "posology", label: "Posologie", ph: "1 cp matin et soir" },
                  { key: "since", label: "Depuis", ph: "01/01/2022" },
                ]}
                onAdd={(v) => sante("medication", "add", v)}
              >
                {dme.medications.map((m) => (
                  <Row key={m.id} title={`${m.name}${m.dosage ? ` ${m.dosage}` : ""}`} sub={[m.posology, m.frequency, m.since ? `depuis le ${fcfa(m.since)}` : ""].filter(Boolean).join(" · ") || (m.active ? "En cours" : "Arrêté")} onDel={canWrite ? () => sante("medication", "del", { id: m.id }) : undefined} />
                ))}
                {dme.medications.length === 0 && <Empty text="Aucun médicament au long cours." />}
              </SanteSection>

              <SanteSection
                title="Allergies" icon="⚠️" canWrite={canWrite}
                fields={[
                  { key: "substance", label: "Substance *", ph: "Ex. : Pénicilline, arachide" },
                  { key: "reaction", label: "Réaction", ph: "Ex. : urticaire, choc" },
                  { key: "severity", label: "Gravité", ph: "legere / moderee / severe" },
                ]}
                onAdd={(v) => sante("allergy", "add", v)}
              >
                {dme.allergies.map((a) => (
                  <Row key={a.id} title={`${a.substance}${a.severity ? ` (${a.severity === "severe" ? "⚠️ sévère" : a.severity})` : ""}`} sub={a.reaction || ""} red onDel={canWrite ? () => sante("allergy", "del", { id: a.id }) : undefined} />
                ))}
                {dme.allergies.length === 0 && <Empty text="Aucune allergie connue." />}
              </SanteSection>

              <SanteSection
                title="Antécédents familiaux" icon="👨‍👩‍👧" canWrite={canWrite}
                fields={[
                  { key: "relative", label: "Membre *", ph: "Ex. : mère" },
                  { key: "condition", label: "Condition *", ph: "Ex. : hypertension" },
                ]}
                onAdd={(v) => sante("family", "add", v)}
              >
                {dme.familyHistory.map((f) => (
                  <Row key={f.id} title={f.condition} sub={f.relative} onDel={canWrite ? () => sante("family", "del", { id: f.id }) : undefined} />
                ))}
                {dme.familyHistory.length === 0 && <Empty text="Rien de déclaré." />}
              </SanteSection>

              <SanteSection
                title="Contre-indications" icon="🚫" canWrite={canWrite}
                fields={[{ key: "item", label: "Élément *", ph: "Ex. : AINS chez l'ulcéreux" }]}
                onAdd={(v) => sante("contraindication", "add", v)}
              >
                {dme.contraindications.map((c) => (
                  <Row key={c.id} title={c.item} sub={c.notes || ""} red onDel={canWrite ? () => sante("contraindication", "del", { id: c.id }) : undefined} />
                ))}
                {dme.contraindications.length === 0 && <Empty text="Aucune contre-indication." />}
              </SanteSection>

              <SanteSection
                title="Histoire sociale" icon="🌱" canWrite={canWrite}
                fields={[
                  { key: "tobacco", label: "Tabac", ph: "Ex. : 1 paquet/j depuis 10 ans" },
                  { key: "alcohol", label: "Alcool", ph: "Ex. : occasionnel" },
                  { key: "activity", label: "Activité physique", ph: "Ex. : marche 3×/sem" },
                  { key: "notes", label: "Notes sociales", ph: "Ex. : travail de nuit" },
                ]}
                addLabel="Mettre à jour"
                onAdd={(v) => sante("social", "add", v)}
              >
                {dme.socialHistory ? (
                  <>
                    {dme.socialHistory.tobacco && <Row title="🚬 Tabac" sub={dme.socialHistory.tobacco} />}
                    {dme.socialHistory.alcohol && <Row title="🍺 Alcool" sub={dme.socialHistory.alcohol} />}
                    {dme.socialHistory.activity && <Row title="🏃 Activité" sub={dme.socialHistory.activity} />}
                    {dme.socialHistory.notes && <Row title="📝 Notes" sub={dme.socialHistory.notes} />}
                  </>
                ) : (
                  <Empty text="Non renseignée." />
                )}
              </SanteSection>
            </div>
          )}

          {/* ================= JOURNAL & SUIVI (V2.4) ================= */}
          {tab === "journal" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h3 className="font-bold text-gray-900">📈 Suivi de santé — mesures du patient</h3>
                {(() => {
                  const latest: Record<string, Metric> = {};
                  for (const m of dme.metrics) if (!latest[m.metric]) latest[m.metric] = m;
                  const keys = Object.keys(latest);
                  return keys.length === 0 ? (
                    <p className="text-sm text-gray-400">Le patient n'a pas encore saisi de mesures depuis son espace.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {keys.map((k) => {
                        const m = latest[k];
                        return (
                          <span key={k} className="px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-900">
                            {METRIC_LABEL[k] || k} : {m.value}{m.value2 ? `/${m.value2}` : ""} {m.unit || ""}
                            <span className="text-emerald-500 font-normal"> · {fcfa(m.taken_at)}</span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
                {dme.metrics.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-emerald-700 font-medium text-xs">Historique (30 dernières mesures)</summary>
                    <div className="mt-2 space-y-1">
                      {dme.metrics.slice(0, 30).map((m) => (
                        <p key={m.id} className="text-xs text-gray-600">
                          {fcfa(m.taken_at)} — <b>{METRIC_LABEL[m.metric] || m.metric}</b> : {m.value}{m.value2 ? `/${m.value2}` : ""} {m.unit || ""} <span className="text-gray-400">({m.source})</span>
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h3 className="font-bold text-gray-900">📝 Journal de santé quotidien (écrit par le patient)</h3>
                {dme.journal.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune entrée pour le moment.</p>
                ) : (
                  dme.journal.map((j) => (
                    <div key={j.id} className="border border-gray-100 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="text-lg">{j.mood ? MOOD_EMOJI[j.mood] : "🗓️"}</span>
                        {format(new Date(j.entry_date), "EEEE d MMMM yyyy", { locale: fr })}
                      </div>
                      {j.symptoms && <p className="text-sm text-gray-700 mt-1"><b>Symptômes :</b> {j.symptoms}</p>}
                      {j.note && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{j.note}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= RAPPORTS (V2.4) ================= */}
          {tab === "rapports" && selectedId && (
            <RapportsTab patientId={selectedId} canWrite={canWrite} />
          )}
        </>
      )}
    </div>
  );
}

/* ================================ COMPOSANTS PARTAGÉS ================================ */
function Row({ title, sub, red, onDel }: { title: string; sub?: string; red?: boolean; onDel?: () => void }) {
  return (
    <div className={`flex items-start gap-2 border rounded-xl px-3 py-2 ${red ? "border-red-100 bg-red-50/50" : "border-gray-100"}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${red ? "text-red-800" : "text-gray-900"}`}>{title}</p>
        {sub ? <p className="text-xs text-gray-500">{sub}</p> : null}
      </div>
      {onDel && (
        <button onClick={onDel} title="Retirer" className="text-gray-300 hover:text-red-500 shrink-0 p-1">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-xs text-gray-400 py-2">{text}</p>;

function SanteSection({
  title, icon, canWrite, fields, onAdd, addLabel, children,
}: {
  title: string; icon: string; canWrite: boolean;
  fields: { key: string; label: string; ph?: string }[];
  onAdd: (vals: Record<string, string>) => void;
  addLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        {canWrite && (
          <button onClick={() => setOpen((o) => !o)} className="ml-auto text-emerald-700 text-xs font-bold hover:underline">
            {open ? "— Fermer" : "+ Ajouter"}
          </button>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
      {open && canWrite && (
        <div className="pt-2 border-t border-gray-100 space-y-2">
          {fields.map((f) => (
            <input
              key={f.key}
              value={vals[f.key] || ""}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
              placeholder={f.label + (f.ph ? ` — ${f.ph}` : "")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          ))}
          <button
            onClick={() => { onAdd(vals); setVals({}); }}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold"
          >
            {addLabel || "Ajouter au dossier"}
          </button>
        </div>
      )}
    </div>
  );
}

function RapportsTab({ patientId, canWrite }: { patientId: number; canWrite: boolean }) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/patients/${patientId}/documents`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d.documents) ? d.documents : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const upload = (file: File) => {
    setError("");
    if (file.size > 1_800_000) { setError("Fichier trop lourd (max 1,8 Mo)."); return; }
    const title = prompt("Titre du rapport (ex. : NFS du 16/08/2026) :");
    if (!title) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(true);
      try {
        const res = await fetch(`/api/patients/${patientId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, mime: file.type || "application/octet-stream", kind: "rapport", data: reader.result }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Erreur d'envoi");
        load();
      } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-gray-900">🗂️ Rapports & documents cliniques</h3>
        {canWrite && (
          <label className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Déposer un rapport
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-400">Scans/photos de résultats, ordonnances papier, comptes rendus — stockés en sécurité avec le même soin que le dossier clinique (max 1,8 Mo).</p>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Aucun document déposé.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
              <FileText size={18} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                <p className="text-xs text-gray-400">{fcfa(d.created_at)} · {Math.round((d.size_bytes || 0) / 1024)} Ko{d.uploaded_by_name ? ` · par ${d.uploaded_by_name}` : ""}</p>
              </div>
              <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="text-xs font-bold text-emerald-700 hover:underline shrink-0">
                Ouvrir →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
