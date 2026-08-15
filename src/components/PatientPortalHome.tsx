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
  }, []);

  const fetchDossier = useCallback(async (dossierToken: string) => {
    const res = await fetch("/api/patient-portal/dossier", {
      headers: { "x-dossier-token": dossierToken },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Impossible d'ouvrir le dossier");
    setDossier(data.patient);
    setExams(Array.isArray(data.exams) ? data.exams : []);
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
                </div>
              );
            })}
          </div>
        )}
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

            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Ton dossier se reverrouille automatiquement dans 15 minutes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
