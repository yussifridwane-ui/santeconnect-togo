"use client";

import { useEffect, useState } from "react";
import { UserCog, UserPlus, KeyRound, Power, Phone, Mail, ShieldCheck } from "lucide-react";

/**
 * 👥 GESTION D'ÉQUIPE (V2.5 — Gestion de cabinet)
 * L'admin configure les dossiers du personnel avec contrôles d'accès sécurisés :
 * création de compte, changement de rôle, activation/désactivation (sans jamais
 * supprimer un compte), réinitialisation de mot de passe.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  doctor: "Médecin",
  nurse: "Infirmier(ère)",
  secretary: "Secrétaire / Caisse",
  lab: "Laborantin",
  pharmacist: "Pharmacien",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  doctor: "bg-blue-100 text-blue-700",
  nurse: "bg-emerald-100 text-emerald-700",
  secretary: "bg-amber-100 text-amber-700",
  lab: "bg-cyan-100 text-cyan-700",
  pharmacist: "bg-green-100 text-green-700",
};

interface Member {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function TeamPage() {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", email: "", phone: "", role: "doctor", password: "" });
  const [addBusy, setAddBusy] = useState(false);
  const [resetFor, setResetFor] = useState<Member | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/team");
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
      } else if (r.status === 403) {
        setErr("Réservé à l'administrateur de l'établissement.");
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  const flashErr = async (r: Response) => {
    const d = await r.json().catch(() => ({}));
    setErr(d.error || "Erreur serveur");
    setTimeout(() => setErr(""), 5000);
  };

  const create = async () => {
    setAddBusy(true);
    const r = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    setAddBusy(false);
    if (r.ok) {
      setShowAdd(false);
      setAddForm({ fullName: "", email: "", phone: "", role: "doctor", password: "" });
      flash("✅ Compte créé ! Communique ses identifiants au membre.");
      load();
    } else flashErr(r);
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    const r = await fetch(`/api/team/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { flash("✅ Modification enregistrée."); load(); }
    else flashErr(r);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="text-emerald-600" /> Gestion d'équipe
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Comptes du personnel, rôles et contrôles d'accès — réservé à l'administrateur.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow"
        >
          <UserPlus size={16} /> Ajouter un membre
        </button>
      </div>

      {msg && <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">{msg}</div>}
      {err && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">{err}</div>}

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide">
                <th className="py-3 px-4">Membre</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Rôle</th>
                <th className="py-3 px-4">Accès</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Aucun membre pour l'instant.</td></tr>
              )}
              {items.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900">{m.full_name}</p>
                    <p className="text-xs text-gray-400">
                      depuis le {new Date(m.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600 space-y-0.5">
                    <p className="flex items-center gap-1"><Mail size={12} /> {m.email}</p>
                    {m.phone && <p className="flex items-center gap-1"><Phone size={12} /> {m.phone}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={m.role}
                      onChange={(e) => patch(m.id, { role: e.target.value })}
                      className={`text-xs font-bold rounded-lg px-2 py-1.5 border-0 cursor-pointer ${ROLE_COLORS[m.role] || "bg-gray-100 text-gray-600"}`}
                    >
                      {Object.entries(ROLE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                      m.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
                    }`}>
                      <ShieldCheck size={12} /> {m.is_active ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setResetFor(m); setNewPwd(""); }}
                        title="Réinitialiser le mot de passe"
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => patch(m.id, { isActive: !m.is_active })}
                        title={m.is_active ? "Désactiver l'accès" : "Réactiver l'accès"}
                        className={`p-2 rounded-lg ${m.is_active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                      >
                        <Power size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        🔒 Sécurité : un compte désactivé n'est jamais supprimé — ses consultations,
        ordonnances et actions passées restent tracées dans le journal de sécurité.
      </p>

      {/* Modale : nouveau membre */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserPlus size={20} className="text-emerald-600" /> Nouveau membre
            </h2>
            <input
              placeholder="Nom complet *"
              value={addForm.fullName}
              onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <input
              type="email"
              placeholder="E-mail *"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <input
              placeholder="Téléphone"
              value={addForm.phone}
              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Mot de passe initial (6 caractères min.) *"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <p className="text-xs text-gray-400">
              💡 Note ce mot de passe et donne-le au membre : il pourra le changer dans ses paramètres.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={create}
                disabled={addBusy || !addForm.fullName || !addForm.email.includes("@") || addForm.password.length < 6}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold"
              >
                {addBusy ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : reset mot de passe */}
      {resetFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <KeyRound size={20} className="text-blue-600" /> Réinitialiser
            </h2>
            <p className="text-sm text-gray-600">
              Nouveau mot de passe pour <b>{resetFor.full_name}</b> :
            </p>
            <input
              type="text"
              placeholder="Nouveau mot de passe (min. 6)"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setResetFor(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  await patch(resetFor.id, { password: newPwd });
                  setResetFor(null);
                }}
                disabled={newPwd.length < 6}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
