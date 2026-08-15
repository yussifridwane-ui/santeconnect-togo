"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, HelpCircle, Loader2, RotateCcw } from "lucide-react";

/**
 * QUIZ D'ENTRAÎNEMENT — réservé aux soignants, volontairement discret.
 * (L'app est un outil de gestion clinique, pas une salle de classe :
 *  les examens eux-mêmes vivent dans le dossier de chaque patient.)
 */
interface QuizQ {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  examSlug: string | null;
}

const CATEGORIES = [
  { value: "", label: "Toutes les catégories" },
  { value: "biologie", label: "🧪 Biologie médicale" },
  { value: "imagerie", label: "🩻 Imagerie" },
  { value: "cardiologie", label: "❤️ Cardiologie" },
  { value: "explorations", label: "🫁 Explorations" },
  { value: "endoscopie", label: "🔬 Endoscopie" },
  { value: "anapath", label: "🧫 Anatomopathologie" },
];

export default function QuizEntrainementPage() {
  const [quizCat, setQuizCat] = useState("");
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/examens/quiz" + (quizCat ? `?category=${quizCat}` : ""));
      const data = await res.json();
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setQIdx(0);
      setScore(0);
      setSelected(null);
      setDone(false);
      setStarted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const answer = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[qIdx].correctIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (qIdx + 1 >= questions.length) setDone(true);
    else {
      setQIdx((i) => i + 1);
      setSelected(null);
    }
  };

  const q = questions[qIdx];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
          <ArrowLeft size={16} /> Tableau de bord
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 space-y-4">
        <div className="text-center space-y-2">
          <HelpCircle size={36} className="mx-auto text-emerald-600" />
          <h1 className="text-xl font-bold text-gray-900">🧠 Quiz d'entraînement clinique</h1>
          <p className="text-sm text-gray-500">
            Réservé aux soignants — 10 questions sur les examens paracliniques, pour garder la main entre deux dossiers. Aucune donnée patient ici.
          </p>
        </div>

        {!started ? (
          <div className="space-y-3">
            <select
              value={quizCat}
              onChange={(e) => setQuizCat(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={start}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "🚀 Démarrer"}
            </button>
          </div>
        ) : done ? (
          <div className="text-center space-y-4">
            <div className="text-5xl">{score >= 8 ? "🏆" : score >= 5 ? "👍" : "📖"}</div>
            <h2 className="text-2xl font-bold text-gray-900">Score : {score} / {questions.length}</h2>
            <p className="text-sm text-gray-500">
              {score >= 8 ? "Excellent, docteur." : score >= 5 ? "Solide — encore un petit tour ?" : "L'entraînement sert à ça : retente ta chance !"}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStarted(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50">
                Menu
              </button>
              <button onClick={start} disabled={loading} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Rejouer
              </button>
            </div>
          </div>
        ) : questions.length === 0 ? (
          <p className="text-center text-gray-500 text-sm">Chargement des questions…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Question {qIdx + 1} / {questions.length}</span>
              <span>Score : {score}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((qIdx + 1) / questions.length) * 100}%` }} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{q.question}</h3>
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const answered = selected !== null;
                const isCorrect = i === q.correctIndex;
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
                {q.explanation && (
                  <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-900 leading-relaxed">
                    💡 {q.explanation}
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={next} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm">
                    {qIdx + 1 >= questions.length ? "Voir mon score" : "Question suivante →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        ⚕️ Contenu d'entraînement — les valeurs de référence varient selon le laboratoire. Aucune donnée patient affichée ici.
      </p>
    </div>
  );
}
