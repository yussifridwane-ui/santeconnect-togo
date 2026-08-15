"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Star, Printer, Pencil, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ExamFormModal, { ExamFull, examCategoryLabel } from "@/components/ExamFormModal";

const DISCLAIMER_VALUES =
  "Les valeurs de référence varient selon le laboratoire, la méthode, l'âge, le sexe et le contexte clinique. Toujours privilégier les valeurs indiquées par VOTRE laboratoire.";
const DISCLAIMER_DIAG =
  "Une anomalie ne constitue jamais, à elle seule, un diagnostic définitif. Ce contenu est fourni à visée pédagogique et ne remplace pas un avis médical.";

const SECTIONS: { key: keyof ExamFull; title: string; emoji: string }[] = [
  { key: "definition", title: "Définition", emoji: "📖" },
  { key: "objective", title: "Objectif", emoji: "🎯" },
  { key: "indications", title: "Indications", emoji: "✅" },
  { key: "contraindications", title: "Contre-indications et précautions", emoji: "🚫" },
  { key: "preparation", title: "Préparation du patient", emoji: "🧴" },
  { key: "procedureText", title: "Déroulement de l'examen", emoji: "🧭" },
  { key: "materials", title: "Prélèvement ou matériel utilisé", emoji: "🧰" },
  { key: "parameters", title: "Paramètres étudiés", emoji: "📊" },
  { key: "referenceValues", title: "Valeurs de référence", emoji: "📏" },
  { key: "interpretation", title: "Interprétation générale", emoji: "🧠" },
  { key: "anomalies", title: "Causes possibles d'anomalies", emoji: "⚠️" },
  { key: "limitations", title: "Limites de l'examen", emoji: "🔍" },
  { key: "references", title: "Références médicales", emoji: "📚" },
];

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ExamDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [exam, setExam] = useState<ExamFull | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/examens/${slug}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setExam(data.exam);
      setIsFavorite(!!data.isFavorite);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) load();
  }, [slug, load]);

  const toggleFav = async () => {
    if (!exam) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await fetch(`/api/examens/${exam.slug}/favorite`, { method: next ? "POST" : "DELETE" });
    } catch (e) {
      setIsFavorite(!next);
    }
  };

  /* Impression dans une fenêtre dédiée (fiche propre, sans interface) */
  const printFiche = () => {
    if (!exam) return;
    const esc = escapeHtml;
    const sections = SECTIONS.filter((s) => exam[s.key])
      .map(
        (s) => `<section>
          <h2>${s.emoji} ${esc(s.title)}</h2>
          <p>${esc(String(exam[s.key] || "")).replace(/\n/g, "<br/>")}</p>
        </section>`
      )
      .join("");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
      <title>${esc(exam.name)} — SantéOnline</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;max-width:760px}
        h1{font-size:22px;margin:0 0 4px}
        .meta{color:#555;font-size:12px;margin-bottom:16px}
        section{margin:14px 0;border-top:1px solid #ddd;padding-top:10px}
        h2{font-size:15px;margin:0 0 6px;color:#065f46}
        p{font-size:13px;line-height:1.55;margin:0;white-space:normal}
        .warning{background:#fff7ed;border:1px solid #fdba74;font-size:11px;padding:8px;border-radius:6px;margin-top:18px}
        .brand{color:#059669;font-weight:bold;font-size:12px;margin-bottom:12px}
      </style></head><body>
      <div class="brand">SantéOnline — Bibliothèque des examens paracliniques</div>
      <h1>${esc(exam.name)}</h1>
      <div class="meta">Catégorie : ${esc(examCategoryLabel(exam.category))} · Mise à jour : ${
        exam.updatedOn ? new Date(exam.updatedOn).toLocaleDateString("fr-FR") : "—"
      }</div>
      ${sections}
      <div class="warning">⚕️ ${esc(DISCLAIMER_VALUES)}<br/>⚕️ ${esc(DISCLAIMER_DIAG)}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  if (loading) {
    return <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mt-16" />;
  }

  if (notFound || !exam) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-gray-600">Fiche introuvable ou non publiée.</p>
        <Link href="/dashboard/examens" className="text-emerald-700 font-semibold hover:underline">
          ← Retour à la bibliothèque
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between gap-2">
        <Link href="/dashboard/examens" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-700">
          <ArrowLeft size={18} /> Bibliothèque
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFav}
            title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            className={`p-2.5 rounded-xl border ${isFavorite ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200 hover:bg-amber-50"}`}
          >
            <Star size={18} className={isFavorite ? "fill-amber-400 text-amber-400" : "text-gray-400"} />
          </button>
          <button onClick={printFiche} title="Imprimer la fiche" className="p-2.5 rounded-xl border bg-white border-gray-200 hover:bg-gray-50">
            <Printer size={18} className="text-gray-600" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <Pencil size={16} /> Modifier
            </button>
          )}
        </div>
      </div>

      {/* En-tête de la fiche */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8">
        {exam.status === "draft" && isAdmin && (
          <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-xl text-sm text-gray-700 flex items-center gap-2">
            <AlertTriangle size={16} /> Brouillon — invisible pour les non-administrateurs.
          </div>
        )}
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          {examCategoryLabel(exam.category)}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">{exam.name}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {exam.updatedOn ? `Dernière mise à jour : ${new Date(exam.updatedOn).toLocaleDateString("fr-FR")}` : ""}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.filter((s) => exam[s.key]).map((s) => {
          const isRef = s.key === "referenceValues";
          const isLimit = s.key === "limitations";
          return (
            <section
              key={s.key}
              className={`rounded-3xl border p-6 ${
                isRef
                  ? "bg-amber-50/60 border-amber-200"
                  : "bg-white border-gray-200"
              }`}
            >
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <span>{s.emoji}</span> {s.title}
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed mt-2 whitespace-pre-line">
                {String(exam[s.key])}
              </p>
              {isRef && (
                <p className="text-xs text-amber-800 mt-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {DISCLAIMER_VALUES}
                </p>
              )}
              {isLimit && (
                <p className="text-xs text-gray-500 mt-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {DISCLAIMER_DIAG}
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* Avertissement final */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs sm:text-sm text-emerald-900 leading-relaxed">
        ⚕️ <b>Rappel professionnel</b> — {DISCLAIMER_VALUES} {DISCLAIMER_DIAG}
      </div>

      {showEdit && isAdmin && (
        <ExamFormModal
          initial={exam}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}
