"use client";

import { useState } from "react";
import { X, Loader2, Save } from "lucide-react";

/** Fiche d'examen complète (telle que renvoyée par l'API détail). */
export interface ExamFull {
  id: number;
  slug: string;
  name: string;
  category: string;
  status: string;
  definition: string;
  objective?: string | null;
  indications?: string | null;
  contraindications?: string | null;
  preparation?: string | null;
  procedureText?: string | null;
  materials?: string | null;
  parameters?: string | null;
  referenceValues?: string | null;
  interpretation?: string | null;
  anomalies?: string | null;
  limitations?: string | null;
  references?: string | null;
  updatedOn?: string | null;
}

const CATEGORIES = [
  { value: "biologie", label: "🧪 Biologie médicale" },
  { value: "imagerie", label: "🩻 Imagerie" },
  { value: "cardiologie", label: "❤️ Cardiologie" },
  { value: "explorations", label: "🫁 Explorations fonctionnelles" },
  { value: "endoscopie", label: "🔬 Endoscopie" },
  { value: "anapath", label: "🧫 Anatomopathologie" },
];

const FIELDS: { key: keyof ExamFull; label: string }[] = [
  { key: "definition", label: "Définition *" },
  { key: "objective", label: "Objectif" },
  { key: "indications", label: "Indications" },
  { key: "contraindications", label: "Contre-indications et précautions" },
  { key: "preparation", label: "Préparation du patient" },
  { key: "procedureText", label: "Déroulement de l'examen" },
  { key: "materials", label: "Prélèvement ou matériel utilisé" },
  { key: "parameters", label: "Paramètres étudiés" },
  { key: "referenceValues", label: "Valeurs de référence (repères usuels)" },
  { key: "interpretation", label: "Interprétation générale" },
  { key: "anomalies", label: "Causes possibles d'anomalies" },
  { key: "limitations", label: "Limites de l'examen" },
  { key: "references", label: "Références médicales" },
];

interface Props {
  initial: ExamFull | null; // null = création
  onClose: () => void;
  onSaved: (slug: string) => void;
}

export const examCategoryLabel = (c: string) =>
  CATEGORIES.find((x) => x.value === c)?.label || c;

export default function ExamFormModal({ initial, onClose, onSaved }: Props) {
  const editing = !!initial;
  const [form, setForm] = useState<ExamFull>(
    initial || {
      id: 0,
      slug: "",
      name: "",
      category: "biologie",
      status: "published",
      definition: "",
      objective: "",
      indications: "",
      contraindications: "",
      preparation: "",
      procedureText: "",
      materials: "",
      parameters: "",
      referenceValues: "",
      interpretation: "",
      anomalies: "",
      limitations: "",
      references: "",
      updatedOn: new Date().toISOString().slice(0, 10),
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof ExamFull, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.definition.trim()) {
      setError("Le nom et la définition sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/examens/${initial!.slug}` : "/api/examens",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");
      onSaved(editing ? initial!.slug : data.slug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? `✏️ Modifier « ${initial!.name} »` : "➕ Nouvelle fiche d'examen"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nom de l'examen *</label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ex. : Échographie abdominale"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="published">✅ Publiée</option>
                  <option value="draft">📝 Brouillon (invisible)</option>
                </select>
              </div>
            </div>
          </div>

          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{f.label}</label>
              <textarea
                value={String(form[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
                rows={f.key === "definition" ? 3 : 2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          ))}

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            ⚕️ Rappel : les valeurs de référence varient selon le laboratoire, la méthode, l'âge, le sexe et le
            contexte clinique. Une anomalie ne constitue jamais, à elle seule, un diagnostic définitif.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}
        </form>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {editing ? "Enregistrer" : "Créer la fiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
