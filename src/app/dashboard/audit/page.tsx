"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  patient_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  detail: string | null;
  created_at: string;
}

const ACTION_STYLE: Record<string, { label: string; cls: string }> = {
  connexion: { label: "Connexion", cls: "bg-gray-100 text-gray-700" },
  consulter: { label: "Consultation", cls: "bg-blue-50 text-blue-700" },
  creer: { label: "Création", cls: "bg-emerald-50 text-emerald-700" },
  modifier: { label: "Modification", cls: "bg-amber-50 text-amber-700" },
  supprimer: { label: "Suppression", cls: "bg-red-50 text-red-700" },
  valider: { label: "Validation", cls: "bg-emerald-50 text-emerald-700" },
  imprimer: { label: "Impression", cls: "bg-purple-50 text-purple-700" },
  refus: { label: "⛔ Accès refusé", cls: "bg-red-100 text-red-800" },
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const fetchEntries = async (q = "") => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit" + (q ? `?q=${encodeURIComponent(q)}` : ""));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur de chargement");
      }
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" /> Journal de sécurité
          </h1>
          <p className="text-gray-500 mt-1">
            Qui a consulté, créé ou modifié quelles données — inaltérable, horodaté.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un utilisateur, une action…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchEntries(search)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-red-100 p-8 text-center text-red-600 font-medium">{error}</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <ShieldCheck size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune entrée pour le moment</h3>
          <p className="text-gray-500">Les accès aux dossiers patients seront enregistrés ici automatiquement.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & heure</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const style = ACTION_STYLE[e.action] || { label: e.action, cls: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {format(new Date(e.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{e.user_name || "—"}</p>
                        <p className="text-xs text-gray-500 capitalize">{e.user_role}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${style.cls}`}>{style.label}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 hidden md:table-cell max-w-md">
                        <span className="line-clamp-2">{e.detail || `${e.entity} #${e.entity_id ?? ""}`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
