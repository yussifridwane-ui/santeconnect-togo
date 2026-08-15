"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Star,
  Loader2,
  BookOpen,
  History,
  Layers,
  HelpCircle,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ExamFormModal, { ExamFull, examCategoryLabel } from "@/components/ExamFormModal";

interface ExamItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  status: string;
  definition: string;
  updatedOn: string | null;
  isFavorite: boolean;
  lastViewed: string | null;
}

interface QuizQ {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  examSlug: string | null;
}

interface CaseItem {
  slug: string;
  title: string;
  category: string;
  vignette: string;
  question: string;
  options: string[];
  correctIndex: number;
  analysis: string;
  examSlug: string | null;
  examName: string | null;
}

const TABS = [
  { key: "biblio", label: "📚 Bibliothèque", icon: BookOpen },
  { key: "favoris", label: "⭐ Favoris", icon: Star },
  { key: "historique", label: "🕘 Historique", icon: History },
  { key: "revision", label: "🃏 Révision", icon: Layers },
  { key: "quiz", label: "❓ Quiz", icon: HelpCircle },
  { key: "cas", label: "🩺 Cas cliniques", icon: Stethoscope },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CATEGORY_FILTERS = [
  { value: "", label: "Toutes les catégories" },
  { value: "biologie", label: "🧪 Biologie médicale" },
  { value: "imagerie", label: "🩻 Imagerie" },
  { value: "cardiologie", label: "❤️ Cardiologie" },
  { value: "explorations", label: "🫁 Explorations" },
  { value: "endoscopie", label: "🔬 Endoscopie" },
  { value: "anapath", label: "🧫 Anatomopathologie" },
];

const CAT_COLOR: Record<string, string> = {
  biologie: "bg-sky-100 text-sky-800",
  imagerie: "bg-indigo-100 text-indigo-800",
  cardiologie: "bg-rose-100 text-rose-800",
  explorations: "bg-teal-100 text-teal-800",
  endoscopie: "bg-amber-100 text-amber-800",
  anapath: "bg-purple-100 text-purple-800",
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "";

export default function ExamensPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<TabKey>("biblio");
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);

  /* ---- Révision (cartes mémoire) ---- */
  const [revIndex, setRevIndex] = useState(0);
  const [revFlipped, setRevFlipped] = useState(false);

  /* ---- Quiz ---- */
  const [quizCat, setQuizCat] = useState("");
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  /* ---- Cas cliniques ---- */
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoaded, setCasesLoaded] = useState(false);
  const [casePick, setCasePick] = useState<Record<string, number>>({});

  const fetchExams = useCallback(async (t: TabKey, query: string, cat: string) => {
    setLoading(true);
    try {
      let url = "/api/examens";
      if (t === "favoris") url += "?favorites=1";
      else if (t === "historique") url += "?history=1";
      else {
        const p = new URLSearchParams();
        if (query) p.set("q", query);
        if (cat) p.set("category", cat);
        const s = p.toString();
        if (s) url += "?" + s;
      }
      const res = await fetch(url);
      const data = await res.json();
      setExams(Array.isArray(data.exams) ? data.exams : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams(tab, q, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category]);

  useEffect(() => {
    if (tab === "cas" && !casesLoaded) {
      fetch("/api/examens/cas")
        .then((r) => r.json())
        .then((d) => setCases(Array.isArray(d.cases) ? d.cases : []))
        .catch(() => {})
        .finally(() => setCasesLoaded(true));
    }
  }, [tab, casesLoaded]);

  const toggleFav = async (slug: string, fav: boolean) => {
    // Optimiste
    setExams((prev) => prev.map((x) => (x.slug === slug ? { ...x, isFavorite: !fav } : x)));
    try {
      await fetch(`/api/examens/${slug}/favorite`, { method: fav ? "DELETE" : "POST" });
      if (tab === "favoris") fetchExams("favoris", "", "");
    } catch (e) {
      console.error(e);
    }
  };

  /* ---- Quiz ---- */
  const startQuiz = async () => {
    setQuizLoading(true);
    try {
      const res = await fetch("/api/examens/quiz" + (quizCat ? `?category=${quizCat}` : ""));
      const data = await res.json();
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setQIdx(0);
      setScore(0);
      setSelected(null);
      setQuizDone(false);
      setQuizStarted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setQuizLoading(false);
    }
  };

  const answer = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[qIdx].correctIndex) setScore((s) => s + 1);
  };

  const nextQ = () => {
    if (qIdx + 1 >= questions.length) setQuizDone(true);
    else {
      setQIdx((i) => i + 1);
      setSelected(null);
    }
  };

  /* ================================ RENDU ================================ */
  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Examens paracliniques</h1>
          <p className="text-sm text-gray-500">Bibliothèque pédagogique — fiches, révision, quiz et cas cliniques.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm"
          >
            <Plus size={18} /> Nouvelle fiche
          </button>
        )}
      </div>

      {/* Avertissement pédagogique permanent */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-900 leading-relaxed">
        ⚕️ <b>Valeurs indicatives</b> : elles varient selon le laboratoire, la méthode, l'âge, le sexe et le contexte
        clinique — toujours privilégier les valeurs de référence du laboratoire. Un résultat anormal ne constitue
        jamais, à lui seul, un diagnostic définitif. Contenu à visée <b>pédagogique</b> — ne remplace pas un avis
        médical.
      </div>

      {/* Onglets */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-emerald-600 text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- Bibliothèque / Favoris / Historique ---------- */}
      {(tab === "biblio" || tab === "favoris" || tab === "historique") && (
        <div className="space-y-4">
          {tab === "biblio" && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchExams("biblio", q, category)}
                  placeholder="Rechercher un examen (ex. : NFS, doppler, thyroïde…)"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {CATEGORY_FILTERS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => fetchExams("biblio", q, category)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm"
              >
                Rechercher
              </button>
            </div>
          )}

          <ExamGrid
            exams={exams}
            loading={loading}
            emptyText={
              tab === "favoris"
                ? "Aucun favori — touchez l'étoile d'une fiche pour la retrouver ici."
                : tab === "historique"
                ? "Votre historique de consultation est vide."
                : "Aucune fiche trouvée pour cette recherche."
            }
            showLastViewed={tab === "historique"}
            onToggleFav={toggleFav}
          />
        </div>
      )}

      {/* ---------- Révision (cartes mémoire) ---------- */}
      {tab === "revision" && (
        <div className="space-y-4">
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          ) : exams.length === 0 ? (
            <p className="text-center text-gray-500 py-10">Aucune fiche à réviser.</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 text-center">
                Carte {revIndex + 1} / {exams.length} — touchez la carte pour afficher la définition.
              </p>
              <button
                onClick={() => setRevFlipped((f) => !f)}
                className="block w-full max-w-2xl mx-auto bg-white border-2 border-emerald-200 rounded-3xl p-8 min-h-[220px] shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${CAT_COLOR[exams[revIndex].category] || "bg-gray-100 text-gray-700"}`}>
                  {examCategoryLabel(exams[revIndex].category)}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-4">{exams[revIndex].name}</h3>
                {revFlipped ? (
                  <p className="text-gray-600 text-sm mt-4 leading-relaxed text-left">{exams[revIndex].definition}</p>
                ) : (
                  <p className="text-emerald-600 text-sm mt-6 font-medium">👆 Toucher pour révéler la définition</p>
                )}
              </button>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setRevIndex((i) => Math.max(0, i - 1)); setRevFlipped(false); }}
                  disabled={revIndex === 0}
                  className="p-2.5 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => {
                    setRevIndex(Math.floor(Math.random() * exams.length));
                    setRevFlipped(false);
                  }}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
                >
                  <RotateCcw size={16} /> Au hasard
                </button>
                <button
                  onClick={() => { setRevIndex((i) => Math.min(exams.length - 1, i + 1)); setRevFlipped(false); }}
                  disabled={revIndex >= exams.length - 1}
                  className="p-2.5 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- Quiz ---------- */}
      {tab === "quiz" && (
        <div className="max-w-2xl mx-auto space-y-4">
          {!quizStarted ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-4">
              <HelpCircle size={40} className="mx-auto text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">QCM — Testez vos connaissances</h2>
              <p className="text-sm text-gray-500">10 questions tirées au hasard, correction immédiate avec explication.</p>
              <select
                value={quizCat}
                onChange={(e) => setQuizCat(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-sm"
              >
                {CATEGORY_FILTERS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={startQuiz}
                disabled={quizLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {quizLoading ? <Loader2 size={18} className="animate-spin" /> : "🚀 Démarrer le quiz"}
              </button>
            </div>
          ) : quizDone ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-4">
              <div className="text-5xl">{score >= 8 ? "🏆" : score >= 5 ? "👍" : "📖"}</div>
              <h2 className="text-2xl font-bold text-gray-900">Score : {score} / {questions.length}</h2>
              <p className="text-sm text-gray-500">
                {score >= 8
                  ? "Excellent ! Vos connaissances sont solides."
                  : score >= 5
                  ? "Bon travail — continuez de réviser les fiches concernées."
                  : "Ne vous découragez pas : relisez les fiches, elle sont faites pour ça, et retentez le quiz !"}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setQuizStarted(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50">
                  Menu quiz
                </button>
                <button onClick={startQuiz} disabled={quizLoading} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                  {quizLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Rejouer
                </button>
              </div>
            </div>
          ) : questions.length > 0 ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Question {qIdx + 1} / {questions.length}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${CAT_COLOR[questions[qIdx].category] || "bg-gray-100"}`}>
                  {examCategoryLabel(questions[qIdx].category)}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((qIdx + 1) / questions.length) * 100}%` }} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{questions[qIdx].question}</h3>
              <div className="space-y-2">
                {questions[qIdx].options.map((opt, i) => {
                  const answered = selected !== null;
                  const isCorrect = i === questions[qIdx].correctIndex;
                  const isPicked = i === selected;
                  return (
                    <button
                      key={i}
                      onClick={() => answer(i)}
                      disabled={answered}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors flex items-start gap-3 ${
                        answered && isCorrect
                          ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                          : answered && isPicked && !isCorrect
                          ? "bg-red-50 border-red-300 text-red-900"
                          : "bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                      }`}
                    >
                      {answered && isCorrect ? (
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                      ) : answered && isPicked ? (
                        <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0 mt-0.5" />
                      )}
                      {opt}
                    </button>
                  );
                })}
              </div>
              {selected !== null && (
                <div className="space-y-3">
                  {questions[qIdx].explanation && (
                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-900 leading-relaxed">
                      💡 {questions[qIdx].explanation}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    {questions[qIdx].examSlug ? (
                      <Link href={`/dashboard/examens/${questions[qIdx].examSlug}`} className="text-sm text-emerald-700 font-semibold hover:underline">
                        📖 Voir la fiche complète →
                      </Link>
                    ) : <span />}
                    <button onClick={nextQ} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm">
                      {qIdx + 1 >= questions.length ? "Voir mon score" : "Question suivante →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ---------- Cas cliniques ---------- */}
      {tab === "cas" && (
        <div className="space-y-5">
          {!casesLoaded ? (
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          ) : cases.length === 0 ? (
            <p className="text-center text-gray-500 py-10">Aucun cas clinique disponible pour le moment.</p>
          ) : (
            cases.map((c) => {
              const pick = casePick[c.slug];
              const answered = pick !== undefined;
              return (
                <div key={c.slug} className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${CAT_COLOR[c.category] || "bg-gray-100 text-gray-700"}`}>
                      {examCategoryLabel(c.category)}
                    </span>
                    {answered && (pick === c.correctIndex ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">✅ Bonne réponse</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">🔄 À revoir</span>
                    ))}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">🩺 {c.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-4">{c.vignette}</p>
                  <p className="font-semibold text-gray-900 text-sm">{c.question}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {c.options.map((opt, i) => {
                      const isCorrect = i === c.correctIndex;
                      const isPicked = i === pick;
                      return (
                        <button
                          key={i}
                          onClick={() => !answered && setCasePick((p) => ({ ...p, [c.slug]: i }))}
                          className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                            answered && isCorrect
                              ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold"
                              : answered && isPicked && !isCorrect
                              ? "bg-red-50 border-red-300 text-red-900"
                              : "bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <div className="space-y-3">
                      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-900 leading-relaxed whitespace-pre-line">
                        🧠 <b>Analyse :</b> {c.analysis}
                      </div>
                      {c.examSlug && (
                        <Link href={`/dashboard/examens/${c.examSlug}`} className="inline-block text-sm text-emerald-700 font-semibold hover:underline">
                          📖 Lire la fiche « {c.examName || c.examSlug} » →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {showForm && isAdmin && (
        <ExamFormModal
          initial={null}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchExams(tab, q, category);
          }}
        />
      )}
    </div>
  );
}

/* ---- Grille de fiches (bibliothèque / favoris / historique) ---- */
function ExamGrid({
  exams,
  loading,
  emptyText,
  showLastViewed,
  onToggleFav,
}: {
  exams: ExamItem[];
  loading: boolean;
  emptyText: string;
  showLastViewed: boolean;
  onToggleFav: (slug: string, fav: boolean) => void;
}) {
  if (loading) {
    return <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />;
  }
  if (exams.length === 0) {
    return <p className="text-center text-gray-500 py-10 text-sm">{emptyText}</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {exams.map((e) => (
        <div key={e.slug} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${CAT_COLOR[e.category] || "bg-gray-100 text-gray-700"}`}>
              {examCategoryLabel(e.category)}
            </span>
            <button
              onClick={() => onToggleFav(e.slug, e.isFavorite)}
              title={e.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              className="p-1.5 rounded-lg hover:bg-amber-50"
            >
              <Star size={18} className={e.isFavorite ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-400"} />
            </button>
          </div>
          <Link href={`/dashboard/examens/${e.slug}`} className="group flex-1">
            <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 leading-snug">{e.name}</h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-3">{e.definition}</p>
          </Link>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
            <span>
              {showLastViewed && e.lastViewed
                ? `Vu le ${fmtDate(e.lastViewed)}`
                : e.updatedOn
                ? `Maj ${fmtDate(e.updatedOn)}`
                : ""}
            </span>
            <Link href={`/dashboard/examens/${e.slug}`} className="text-emerald-700 font-semibold hover:underline">
              Ouvrir →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
