"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Lock, LockOpen, Loader2, ShieldCheck, KeyRound, FlaskConical, ScanLine, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Apt {
  id: number;
  title: string;
  type: string | null;
  status: string;
  scheduledDate: string;
  notes?: string | null;
  doctorName?: string | null;
  facilityName?: string | null;
  patientResponse?: string | null;
}

interface PortalExam {
  kind: "labo" | "imagerie";
  name: string;
  status: string;
  result: string | null;
  created_at: string;
  validated_at: string | null;
}

interface PortalDossier {
  recordNumber: string | null;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  medicalNotes: string | null;
  insurerName: string | null;
  coverageStatus: string | null;
}

interface PCondition { id: number; name: string; icd_code: string | null; diagnosed_year: number | null; status: string; }
interface PMed { id: number; name: string; dosage: string | null; posology: string | null; frequency: string | null; }
interface PAllergy { id: number; substance: string; reaction: string | null; severity: string | null; }
interface PDoc { id: number; kind: string; title: string; mime: string; size_bytes: number; created_at: string; }
interface JEntry { id: number; entry_date: string; mood: number | null; symptoms: string | null; note: string | null; }
interface MetricRow { id: number; metric: string; value: number | null; value2: number | null; unit: string | null; taken_at: string; }

const METRIC_OPTS: { k: string; label: string; unit: string; dual?: boolean }[] = [
  { k: "poids", label: "⚖️ Poids", unit: "kg" },
  { k: "glycemie", label: "🩸 Glycémie", unit: "g/L" },
  { k: "tension", label: "🩺 Tension", unit: "mmHg", dual: true },
  { k: "temperature", label: "🌡️ Température", unit: "°C" },
  { k: "pouls", label: "💓 Pouls", unit: "/min" },
  { k: "spo2", label: "🫁 SpO₂", unit: "%" },
  { k: "douleur", label: "😣 Douleur", unit: "/10" },
  { k: "sommeil", label: "😴 Sommeil", unit: "h" },
];
const MOODS = ["😫", "😕", "😐", "🙂", "😄"];

const APT_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "🟡 En attente", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "✅ Confirmé", cls: "bg-emerald-100 text-emerald-800" },
  completed: { label: "✔️ Terminé", cls: "bg-teal-100 text-teal-800" },
  cancelled: { label: "❌ Annulé", cls: "bg-red-100 text-red-700" },
  no_show: { label: "⚠️ Manqué", cls: "bg-gray-100 text-gray-600" },
  rescheduled: { label: "🔄 Reporté", cls: "bg-sky-100 text-sky-800" },
};

const ageFrom = (dob: string | null | undefined) => {
  if (!dob) return "—";
  const a = new Date().getFullYear() - new Date(dob).getFullYear();
  return Number.isFinite(a) && a >= 0 ? `${a} ans` : "—";
};

/**
 * ACCUEIL PATIENT — V2.2.
 * Sans code : il ne lit QUE ses rendez-vous.
 * Avec son code (style T-Money, créé par lui à la 1re connexion) : son dossier s'ouvre.
 */
export default function PatientPortalHome({ userName }: { userName: string }) {
  const [apts, setApts] = useState<Apt[]>([]);
  const [aptsLoading, setAptsLoading] = useState(true);

  const [gate, setGate] = useState<"loading" | "noDossier" | "create" | "locked" | "open">("loading");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [gateError, setGateError] = useState("");
  const [gateMsg, setGateMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [dossier, setDossier] = useState<PortalDossier | null>(null);
  const [exams, setExams] = useState<PortalExam[]>([]);
  const [conds, setConds] = useState<PCondition[]>([]);
  const [meds, setMeds] = useState<PMed[]>([]);
  const [alls, setAlls] = useState<PAllergy[]>([]);
  const [docs, setDocs] = useState<PDoc[]>([]);

  /* Journal & suivi (visibles sans le code — ce sont tes propres saisies) */
  const [journal, setJournal] = useState<JEntry[]>([]);
  const [jMood, setJMood] = useState(3);
  const [jSymptoms, setJSymptoms] = useState("");
  const [jNote, setJNote] = useState("");
  const [jBusy, setJBusy] = useState(false);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [latest, setLatest] = useState<MetricRow[]>([]);
  const [mKey, setMKey] = useState("poids");
  const [mVal, setMVal] = useState("");
  const [mVal2, setMVal2] = useState("");
  const [mBusy, setMBusy] = useState(false);
  const [healthMsg, setHealthMsg] = useState("");

  /* 🗓️ Réservation en ligne (V2.5) */
  const [doctors, setDoctors] = useState<{ id: number; full_name: string }[]>([]);
  const [bkDoctor, setBkDoctor] = useState("");
  const [bkDate, setBkDate] = useState("");
  const [bkTime, setBkTime] = useState("");
  const [bkMotif, setBkMotif] = useState("");
  const [bkBusy, setBkBusy] = useState(false);
  const [bkMsg, setBkMsg] = useState("");

  const bookRdv = async () => {
    setBkBusy(true);
    setBkMsg("");
    try {
      const r = await fetch("/api/patient-portal/rdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: bkDoctor || undefined,
          date: bkDate, time: bkTime,
          motif: bkMotif || "Consultation",
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setBkMsg("✅ Demande envoyée ! Le centre va confirmer ton rendez-vous — tu le verras ici même.");
        setBkDoctor(""); setBkDate(""); setBkTime(""); setBkMotif("");
        const rr = await fetch("/api/appointments");
        const dd = await rr.json();
        setApts(Array.isArray(dd) ? dd : []);
      } else {
        setBkMsg("⚠️ " + (d.error || "Impossible d'envoyer la demande."));
      }
    } finally {
      setBkBusy(false);
    }
  };

  useEffect(() => {
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setApts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setAptsLoading(false));

    fetch("/api/patient-portal/code")
      .then((r) => r.json())
      .then((d) => {
        if (!d.hasDossier) setGate("noDossier");
        else setGate(d.hasCode ? "locked" : "create");
      })
      .catch(() => setGate("locked"));

    refreshHealth();

    /* 🗓️ Médecins de mon centre pour la réservation en ligne */
    fetch("/api/patient-portal/rdv")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.doctors)) setDoctors(d.doctors); })
      .catch(() => {});
  }, []);

  const refreshHealth = () => {
    fetch("/api/patient-portal/journal")
      .then((r) => r.json())
      .then((d) => setJournal(Array.isArray(d.entries) ? d.entries : []))
      .catch(() => {});
    fetch("/api/patient-portal/metrics")
      .then((r) => r.json())
      .then((d) => {
        setMetrics(Array.isArray(d.metrics) ? d.metrics : []);
        setLatest(Array.isArray(d.latest) ? d.latest : []);
      })
      .catch(() => {});
  };

  const fetchDossier = useCallback(async (dossierToken: string) => {
    const res = await fetch("/api/patient-portal/dossier", {
      headers: { "x-dossier-token": dossierToken },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Impossible d'ouvrir le dossier");
    setDossier(data.patient);
    setExams(Array.isArray(data.exams) ? data.exams : []);
    setConds(Array.isArray(data.conditions) ? data.conditions : []);
    setMeds(Array.isArray(data.medications) ? data.medications : []);
    setAlls(Array.isArray(data.allergies) ? data.allergies : []);
    setDocs(Array.isArray(data.documents) ? data.documents : []);
    setGate("open");
  }, []);

  const createCode = async () => {
    setGateError("");
    if (!/^\d{4,6}$/.test(code)) {
      setGateError("Le code doit contenir 4 à 6 chiffres (ex. 7294).");
      return;
    }
    if (code !== confirm) {
      setGateError("Les deux codes ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/patient-portal/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setGateMsg("✅ Code créé ! Tape-le maintenant pour ouvrir ton dossier.");
      setCode("");
      setConfirm("");
      setGate("locked");
    } catch (e) {
      setGateError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setGateError("");
    setBusy(true);
    try {
      const res = await fetch("/api/patient-portal/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needSetup) setGate("create");
        throw new Error(data.error || "Code incorrect");
      }
      setToken(data.dossierToken);
      setCode("");
      setGateMsg("");
      await fetchDossier(data.dossierToken);
    } catch (e) {
      setGateError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    setToken("");
    setDossier(null);
    setExams([]);
    setGate("locked");
  };

  /* V2.4 : journal quotidien + mesures de suivi */
  const saveJournal = async () => {
    setHealthMsg("");
    if (!jNote.trim() && !jSymptoms.trim()) { setHealthMsg("Écris au moins une note ou un symptôme."); return; }
    setJBusy(true);
    try {
      const res = await fetch("/api/patient-portal/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: jMood, symptoms: jSymptoms, note: jNote }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      setJNote(""); setJSymptoms("");
      setHealthMsg("✅ Journal du jour enregistré !");
      refreshHealth();
    } catch (e) { setHealthMsg((e as Error).message); } finally { setJBusy(false); }
  };

  const saveMetric = async () => {
    setHealthMsg("");
    const cfg = METRIC_OPTS.find((m) => m.k === mKey)!;
    if (!mVal || (cfg.dual && !mVal2)) { setHealthMsg("Saisis la mesure complète."); return; }
    setMBusy(true);
    try {
      const res = await fetch("/api/patient-portal/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric: mKey, value: mVal, value2: mVal2 || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      setMVal(""); setMVal2("");
      setHealthMsg("✅ Mesure enregistrée !");
      refreshHealth();
    } catch (e) { setHealthMsg((e as Error).message); } finally { setMBusy(false); }
  };

  const openDoc = async (id: number) => {
    const res = await fetch(`/api/documents/${id}`, { headers: { "x-dossier-token": token } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  /* V2.3 : le patient confirme sa présence en 1 clic — sans appeler personne */
  const respondRdv = async (aptId: number, response: "confirmed" | "declined") => {
    setApts((prev) => prev.map((a) => (a.id === aptId ? { ...a, patientResponse: response } : a)));
    try {
      await fetch("/api/patient-portal/rdv-reponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: aptId, response }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const upcoming = apts.filter((a) => new Date(a.scheduledDate) >= new Date(Date.now() - 24 * 3600 * 1000));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Accueil patient */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 rounded-3xl p-6 text-white shadow-lg">
        <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">Espace patient sécurisé</p>
        <h1 className="text-2xl font-bold mt-1">Bonjour {userName} 👋</h1>
        <p className="text-emerald-100 text-sm mt-2">
          Ici tu vois tes rendez-vous. Ton dossier médical est protégé par TON code secret — même ton téléphone perdu ne peut pas l'ouvrir.
        </p>
      </div>

      {/* 📅 Rendez-vous — toujours lisibles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-emerald-600" />
          <h2 className="font-bold text-gray-900">Mes rendez-vous</h2>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">{upcoming.length} à venir</span>
        </div>
        {aptsLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto my-4" />
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucun rendez-vous à venir. Ton centre de santé peut en programmer un pour toi.</p>
        ) : (
          <div className="space-y-2.5">
            {upcoming.slice(0, 10).map((a) => {
              const st = APT_LABELS[a.status] || APT_LABELS.pending;
              return (
                <div key={a.id} className="border border-gray-100 rounded-xl p-3.5 flex flex-wrap items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-50 rounded-xl flex flex-col items-center justify-center text-emerald-700 shrink-0">
                    <span className="text-lg font-bold leading-none">{format(new Date(a.scheduledDate), "dd")}</span>
                    <span className="text-[10px] uppercase">{format(new Date(a.scheduledDate), "MMM", { locale: fr })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{a.title || "Consultation"}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(a.scheduledDate), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      {a.doctorName ? ` · Dr ${a.doctorName}` : ""}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                  {a.patientResponse === "confirmed" && (
                    <span className="w-full text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-1">🙋 Présence confirmée — merci !</span>
                  )}
                  {a.patientResponse === "declined" && (
                    <span className="w-full text-center text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg py-1">⚠️ Empêchement signalé au centre</span>
                  )}
                  {!a.patientResponse && ["pending", "confirmed", "rescheduled"].includes(a.status) && (
                    <div className="w-full grid grid-cols-2 gap-1.5">
                      <button onClick={() => respondRdv(a.id, "confirmed")} className="py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold">
                        ✅ Je serai présent(e)
                      </button>
                      <button onClick={() => respondRdv(a.id, "declined")} className="py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[11px] font-bold">
                        ❌ Empêchement
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🗓️ Prendre rendez-vous EN LIGNE — réservation par le patient lui-même (V2.5) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗓️</span>
          <h2 className="font-bold text-gray-900">Prendre rendez-vous</h2>
        </div>
        <p className="text-xs text-gray-500">
          Choisis ton jour et ton heure — le centre confirme ensuite. Sans code, sans appel téléphonique.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={bkDoctor}
            onChange={(e) => setBkDoctor(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          >
            <option value="">Médecin (facultatif)</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          <input
            type="date"
            value={bkDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBkDate(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
          <input
            type="time"
            value={bkTime}
            onChange={(e) => setBkTime(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
          <input
            placeholder="Motif (ex : fièvre, contrôle…)"
            value={bkMotif}
            onChange={(e) => setBkMotif(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>
        {bkMsg && (
          <p className={`text-sm font-medium ${bkMsg.startsWith("✅") ? "text-emerald-700" : "text-red-600"}`}>{bkMsg}</p>
        )}
        <button
          onClick={bookRdv}
          disabled={bkBusy || !bkDate || !bkTime}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm"
        >
          {bkBusy ? "Envoi…" : "Envoyer ma demande de rendez-vous"}
        </button>
      </div>

      {/* 📝 Journal de santé & suivi — tes propres saisies (sans code) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <h2 className="font-bold text-gray-900">Journal & suivi de santé</h2>
        </div>
        {healthMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">{healthMsg}</div>
        )}

        {/* Comment vas-tu aujourd'hui ? */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase">Comment vas-tu aujourd'hui ?</p>
          <div className="flex gap-2">
            {MOODS.map((m, i) => (
              <button
                key={i}
                onClick={() => setJMood(i + 1)}
                className={`w-11 h-11 rounded-xl text-xl border-2 transition-all ${jMood === i + 1 ? "border-emerald-500 bg-emerald-50 scale-110" : "border-gray-100 bg-white"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            value={jSymptoms}
            onChange={(e) => setJSymptoms(e.target.value)}
            placeholder="Symptômes du jour (ex. : maux de tête, fatigue)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <textarea
            value={jNote}
            onChange={(e) => setJNote(e.target.value)}
            rows={2}
            placeholder="Note libre… (ton équipe médicale suit ton évolution dans le temps)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button onClick={saveJournal} disabled={jBusy} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {jBusy ? <Loader2 size={16} className="animate-spin" /> : "💾 Écrire dans mon journal du jour"}
          </button>
          {journal.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {journal.slice(0, 3).map((j) => (
                <div key={j.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <span className="text-sm">{j.mood ? MOODS[j.mood - 1] : "🗓️"}</span>
                    {format(new Date(j.entry_date), "EEEE d MMMM", { locale: fr })}
                  </div>
                  {j.symptoms && <p className="text-gray-600 mt-0.5">🩹 {j.symptoms}</p>}
                  {j.note && <p className="text-gray-500 mt-0.5">{j.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mesures */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase">📈 Saisir une mesure</p>
          {latest.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {latest.map((m) => (
                <span key={m.metric} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[11px] font-semibold">
                  {METRIC_OPTS.find((o) => o.k === m.metric)?.label || m.metric} : {m.value}{m.value2 ? `/${m.value2}` : ""} {m.unit}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <select value={mKey} onChange={(e) => setMKey(e.target.value)} className="col-span-3 sm:col-span-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
              {METRIC_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
            </select>
            <input
              value={mVal}
              onChange={(e) => setMVal(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder={METRIC_OPTS.find((o) => o.k === mKey)?.dual ? "Systole (12)" : `Valeur (${METRIC_OPTS.find((o) => o.k === mKey)?.unit})`}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center"
            />
            {METRIC_OPTS.find((o) => o.k === mKey)?.dual && (
              <input
                value={mVal2}
                onChange={(e) => setMVal2(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="Diastole (8)"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center"
              />
            )}
          </div>
          <button onClick={saveMetric} disabled={mBusy} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {mBusy ? <Loader2 size={16} className="animate-spin" /> : "➕ Enregistrer la mesure"}
          </button>
        </div>
      </div>

      {/* 🔒 Dossier médical — derrière le code */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          {gate === "open" ? <LockOpen size={20} className="text-emerald-600" /> : <Lock size={20} className="text-gray-400" />}
          <h2 className="font-bold text-gray-900">Mon dossier médical</h2>
          {gate === "open" && (
            <button onClick={lock} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Lock size={13} /> Verrouiller
            </button>
          )}
        </div>

        {gate === "loading" && <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto my-4" />}

        {gate === "noDossier" && (
          <p className="text-sm text-gray-500 text-center py-4">
            Aucun dossier n'est encore lié à ton compte. Présente-toi à ton centre de santé avec une pièce d'identité : l'équipe créera ton dossier et le reliera à ton compte.
          </p>
        )}

        {gate === "create" && (
          <div className="space-y-3">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
              <b>🛡️ Crée ton code secret</b> — comme au T-Money : 4 à 6 chiffres, connu de toi seul. Il protège ton dossier médical.
              Ne le dis à personne, pas même au personnel.
            </div>
            <input
              type={showCode ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Ton code (4 à 6 chiffres)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <input
              type={showCode ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="Retape le même code"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button onClick={() => setShowCode((s) => !s)} className="text-xs text-gray-500 flex items-center gap-1.5 mx-auto">
              {showCode ? <EyeOff size={14} /> : <Eye size={14} />} {showCode ? "Masquer" : "Voir les chiffres"}
            </button>
            {gateError && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{gateError}</div>}
            <button
              onClick={createCode}
              disabled={busy}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} Créer mon code
            </button>
          </div>
        )}

        {gate === "locked" && (
          <div className="space-y-3">
            {gateMsg && <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">{gateMsg}</div>}
            <p className="text-sm text-gray-500">Tape ton code secret pour ouvrir ton dossier (valable 15 minutes) :</p>
            <input
              type={showCode ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button onClick={() => setShowCode((s) => !s)} className="text-xs text-gray-500 flex items-center gap-1.5 mx-auto">
              {showCode ? <EyeOff size={14} /> : <Eye size={14} />} {showCode ? "Masquer" : "Voir les chiffres"}
            </button>
            {gateError && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{gateError}</div>}
            <button
              onClick={unlock}
              disabled={busy || !code}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <LockOpen size={18} />} Déverrouiller
            </button>
            <p className="text-xs text-gray-400 text-center">
              Code oublié ? Demande à ton médecin de le <b>réinitialiser</b> (il ne peut pas le lire, personne ne le peut).
            </p>
          </div>
        )}

        {gate === "open" && dossier && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div><p className="text-xs text-gray-500">N° de dossier</p><p className="text-sm font-semibold font-mono">{dossier.recordNumber || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Nom complet</p><p className="text-sm font-semibold">{dossier.fullName}</p></div>
              <div><p className="text-xs text-gray-500">Âge</p><p className="text-sm font-semibold">{ageFrom(dossier.dateOfBirth)}</p></div>
              <div><p className="text-xs text-gray-500">Groupe sanguin</p><p className="text-sm font-semibold">{dossier.bloodType || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Assurance</p><p className="text-sm font-semibold">{dossier.insurerName || "—"}</p></div>
            </div>

            {dossier.medicalNotes && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs font-bold text-red-700 uppercase mb-1">⚠️ Informations médicales importantes</p>
                <p className="text-sm text-red-700 whitespace-pre-line">{dossier.medicalNotes}</p>
              </div>
            )}

            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-2">🧪 Mes résultats d'examens validés</h3>
              {exams.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun résultat validé pour le moment. Dès qu'un médecin valide un résultat, il apparaît ici.</p>
              ) : (
                <div className="space-y-2.5">
                  {exams.map((e, i) => (
                    <div key={i} className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${e.kind === "labo" ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"}`}>
                          {e.kind === "labo" ? <FlaskConical size={11} /> : <ScanLine size={11} />} {e.kind === "labo" ? "Analyse" : "Imagerie"}
                        </span>
                        <span className="text-xs text-gray-400">
                          validé {e.validated_at ? `le ${format(new Date(e.validated_at), "dd MMM yyyy", { locale: fr })}` : ""}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm mt-1.5">{e.name}</p>
                      {e.result && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{e.result}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🧬 Profil santé unifié */}
            {(conds.length > 0 || meds.length > 0 || alls.length > 0) && (
              <div className="space-y-3 pt-1">
                <h3 className="font-bold text-gray-900 text-sm">🧬 Mon profil de santé</h3>
                {alls.length > 0 && (
                  <div className="space-y-1.5">
                    {alls.map((a) => (
                      <div key={a.id} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm">
                        <b className="text-red-800">⚠️ Allergie : {a.substance}</b>
                        {a.reaction && <span className="text-red-600 text-xs"> — {a.reaction}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {conds.map((c) => (
                  <div key={c.id} className="border border-gray-100 rounded-lg px-3 py-2 text-sm flex flex-wrap gap-2 items-center">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {c.icd_code && <span className="text-xs text-gray-400">({c.icd_code})</span>}
                    {c.diagnosed_year && <span className="text-xs text-gray-400">· depuis {c.diagnosed_year}</span>}
                    <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${c.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {c.status === "resolved" ? "guérie ✓" : "en cours"}
                    </span>
                  </div>
                ))}
                {meds.map((m) => (
                  <div key={m.id} className="border border-gray-100 rounded-lg px-3 py-2 text-sm">
                    <span className="font-semibold text-gray-900">💊 {m.name}{m.dosage ? ` ${m.dosage}` : ""}</span>
                    {[m.posology, m.frequency].filter(Boolean).length > 0 && (
                      <span className="text-xs text-gray-500"> — {[m.posology, m.frequency].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 🗂️ Documents & rapports */}
            {docs.length > 0 && (
              <div className="space-y-2 pt-1">
                <h3 className="font-bold text-gray-900 text-sm">🗂️ Mes documents & rapports</h3>
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 border border-gray-100 rounded-xl p-3">
                    <LockOpen size={16} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                      <p className="text-xs text-gray-400">{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })} · {Math.round((d.size_bytes || 0) / 1024)} Ko</p>
                    </div>
                    <button onClick={() => openDoc(d.id)} className="text-xs font-bold text-emerald-700 hover:underline shrink-0">
                      Ouvrir →
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Ton dossier se reverrouille automatiquement dans 15 minutes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
