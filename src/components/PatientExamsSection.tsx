"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, FlaskConical, ScanLine, FileCheck2, PlayCircle, FileText, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PatientExam {
  id: number;
  kind: "labo" | "imagerie";
  examType: string;
  status: string;
  result: string | null;
  comment: string | null;
  createdAt: string;
  validatedAt: string | null;
  doctorName: string | null;
  validatedByName: string | null;
}

interface CatalogEntry {
  slug: string;
  name: string;
  category: string;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  requested: { label: "🟡 Demandé", cls: "bg-amber-100 text-amber-800" },
  in_progress: { label: "🔵 En cours", cls: "bg-sky-100 text-sky-800" },
  completed: { label: "🟢 Terminé", cls: "bg-teal-100 text-teal-800" },
  validated: { label: "✅ Validé", cls: "bg-emerald-100 text-emerald-800" },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Section « Examens » DU DOSSIER PATIENT — demande, suivi, résultat, validation (aucun « cours » ici). */
export default function PatientExamsSection({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const canPrescribe = user?.role === "admin" || user?.role === "doctor";
  const canUpdate = ["admin", "doctor", "nurse", "lab"].includes(user?.role || "");
  const canValidate = user?.role === "admin" || user?.role === "doctor";

  const [exams, setExams] = useState<PatientExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [resultTarget, setResultTarget] = useState<PatientExam | null>(null);
  const [kind, setKind] = useState<"labo" | "imagerie">("labo");
  const [examType, setExamType] = useState("");
  const [note, setNote] = useState("");
  const [resultText, setResultText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/examens`);
      const data = await res.json();
      if (res.ok) setExams(Array.isArray(data.exams) ? data.exams : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
    fetch("/api/examens/catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(Array.isArray(d.catalog) ? d.catalog : []))
      .catch(() => {});
  }, [load]);

  const addExam = async () => {
    setError("");
    if (!examType.trim()) {
      setError("Choisis ou tape le nom de l'examen.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/examens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, examType: examType.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setShowAdd(false);
      setExamType("");
      setNote("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const update = async (exam: PatientExam, payload: Record<string, string>) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/patients/${patientId}/examens/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: exam.kind, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submitResult = async () => {
    if (!resultTarget) return;
    if (!resultText.trim()) {
      setError("Écris le résultat avant d'enregistrer.");
      return;
    }
    await update(resultTarget, { status: "completed", result: resultText.trim() });
    setResultTarget(null);
    setResultText("");
    setError("");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 print:hidden">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-lg">🧪</span>
        <h2 className="font-bold text-emerald-800 uppercase tracking-wide text-sm">Examens du patient</h2>
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
          {exams.length} examen{exams.length > 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        {canPrescribe && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
          >
            <Plus size={14} /> Demander un examen
          </button>
        )}
      </div>

      {error && !showAdd && !resultTarget && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto my-4" />
      ) : exams.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-5">
          Aucun examen demandé pour ce patient.{canPrescribe ? " Clique sur « Demander un examen » pour commencer." : ""}
        </p>
      ) : (
        <div className="space-y-3">
          {exams.map((e) => {
            const st = STATUS_STYLE[e.status] || STATUS_STYLE.requested;
            return (
              <div key={`${e.kind}-${e.id}`} className="border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${e.kind === "labo" ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"}`}>
                    {e.kind === "labo" ? <FlaskConical size={12} /> : <ScanLine size={12} />}
                    {e.kind === "labo" ? "Biologie" : "Imagerie"}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                  <span className="text-xs text-gray-400">{fmt(e.createdAt)}</span>
                  {e.doctorName && <span className="text-xs text-gray-400">· Dr {e.doctorName}</span>}
                </div>
                <p className="font-semibold text-gray-900 text-sm">{e.examType}</p>
                {e.comment && <p className="text-xs text-gray-500">💬 {e.comment}</p>}
                {e.result && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-emerald-700 font-medium text-xs">📄 Voir le résultat</summary>
                    <p className="mt-2 whitespace-pre-line bg-gray-50 border border-gray-100 rounded-lg p-3 text-gray-700 text-sm">{e.result}</p>
                  </details>
                )}
                {e.status === "validated" && e.validatedByName && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1">
                    <ShieldCheck size={12} /> Validé par Dr {e.validatedByName}{e.validatedAt ? ` le ${fmt(e.validatedAt)}` : ""}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {canUpdate && e.status === "requested" && (
                    <button
                      onClick={() => update(e, { status: "in_progress" })}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      <PlayCircle size={13} /> Débuter
                    </button>
                  )}
                  {canUpdate && (e.status === "in_progress" || e.status === "requested") && (
                    <button
                      onClick={() => {
                        setResultTarget(e);
                        setResultText(e.result || "");
                        setError("");
                      }}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      <FileText size={13} /> Saisir le résultat
                    </button>
                  )}
                  {canValidate && e.status === "completed" && (
                    <button
                      onClick={() => {
                        if (confirm(`Valider définitivement le résultat de « ${e.examType} » ?\nLe patient pourra alors le lire dans son espace.`))
                          update(e, { status: "validated" });
                      }}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      <FileCheck2 size={13} /> Valider (signature médicale)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal : demander un examen */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">🧪 Demander un examen</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setKind("labo")}
                className={`py-3 rounded-xl border-2 text-sm font-semibold ${kind === "labo" ? "border-sky-500 bg-sky-50 text-sky-800" : "border-gray-200 text-gray-500"}`}
              >
                🧪 Biologie
              </button>
              <button
                onClick={() => setKind("imagerie")}
                className={`py-3 rounded-xl border-2 text-sm font-semibold ${kind === "imagerie" ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-gray-200 text-gray-500"}`}
              >
                🩻 Imagerie
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Examen *</label>
              <input
                list="exam-catalog"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                placeholder={kind === "labo" ? "Ex. : NFS, Glycémie, ECBU…" : "Ex. : Radio thorax, Échographie abdominale…"}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
              <datalist id="exam-catalog">
                {catalog.map((c) => (
                  <option key={c.slug} value={c.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Note (facultatif)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ex. : à jeun, suspicion de paludisme…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
            {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setShowAdd(false); setError(""); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 text-sm">
                Annuler
              </button>
              <button onClick={addExam} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Demander
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : saisir le résultat */}
      {resultTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">📄 Résultat — {resultTarget.examType}</h3>
            <textarea
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              rows={6}
              placeholder="Ex. : Hb 12,4 g/dL · GB 6 800/mm³ · Plaquettes 245 000/mm³… (résultats détaillés, valeurs du laboratoire)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              ⚕️ Le résultat ne devient visible par le patient qu'après <b>validation médicale</b> (bouton « Valider » réservé au médecin).
            </p>
            {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setResultTarget(null); setError(""); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 text-sm">
                Annuler
              </button>
              <button onClick={submitResult} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Enregistrer (marque Terminé)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
