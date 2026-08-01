"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  Loader2,
  ShieldCheck,
  Lock,
  BellRing,
  RotateCcw,
  Save,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Rule {
  autoApprovePayments: boolean;
  maxPerTransactionFcfa: number;
  maxPerDayFcfa: number;
  cancelWindowMinutes: number;
  allowedPayoutRecipients: string;
  autoPayoutsEnabled: boolean;
}

interface LogEntry {
  id: number;
  kind: string;
  reference: string;
  amountFcfa: number;
  counterparty: string | null;
  status: string;
  decision: string;
  reason: string | null;
  notifyWaLink: string | null;
  createdAt: string;
  reversedAt: string | null;
}

const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [recipients, setRecipients] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const d = await fetch("/api/automation").then((r) => r.json());
      setRules(d.rules);
      setLog(d.log || []);
      setNow(new Date(d.now).getTime());
      setRecipients(d.rules?.allowedPayoutRecipients || "[]");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async (patch: Partial<Rule>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRules(d.rules);
      setToast("✅ Règles enregistrées.");
    } catch (e: any) {
      setToast("❌ " + (e.message || "Erreur"));
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 5000);
    }
  };

  const reverse = async (id: number) => {
    if (!confirm("Annuler cette transaction automatique et suspendre l'abonnement lié ?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/automation/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast("↩️ Transaction annulée, abonnement suspendu.");
      await load();
    } catch (e: any) {
      setToast("❌ " + (e.message || "Erreur"));
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 5000);
    }
  };

  if (loading || !rules) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const windowMs = rules.cancelWindowMinutes * 60000;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium max-w-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="text-amber-500" size={24} />
          Centre d'automatisation
        </h1>
        <p className="text-gray-500 mt-1">
          Validez les paiements automatiquement pendant vos absences — avec règles, seuils,
          notification après coup et fenêtre d'annulation.
        </p>
      </div>

      {/* Règles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
          <ShieldCheck className="text-emerald-600" size={18} />
          Règles de validation automatique des paiements entrants
        </h2>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={rules.autoApprovePayments}
            onChange={(e) => saveRules({ autoApprovePayments: e.target.checked })}
            className="w-5 h-5 accent-emerald-600"
          />
          <span className="text-sm font-semibold text-emerald-900">
            Activation automatique des abonnements après déclaration de paiement
            <span className="block text-xs font-normal text-emerald-700">
              Si désactivé, chaque paiement attend votre validation manuelle (mode bloquant).
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Plafond / transaction (F)</label>
            <input
              type="number"
              defaultValue={rules.maxPerTransactionFcfa}
              onBlur={(e) => saveRules({ maxPerTransactionFcfa: parseInt(e.target.value) || 0 })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Plafond / jour (F)</label>
            <input
              type="number"
              defaultValue={rules.maxPerDayFcfa}
              onBlur={(e) => saveRules({ maxPerDayFcfa: parseInt(e.target.value) || 0 })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Fenêtre d'annulation (min)</label>
            <input
              type="number"
              defaultValue={rules.cancelWindowMinutes}
              onBlur={(e) => saveRules({ cancelWindowMinutes: parseInt(e.target.value) || 60 })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Au-delà d'un plafond, le paiement reste en validation manuelle. Chaque activation
          automatique vous notifie (WhatsApp / journal) et peut être annulée pendant la fenêtre définie.
        </p>
      </div>

      {/* Payouts sortants */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Lock className="text-gray-400" size={18} />
          Transferts sortants automatiques (payouts)
        </h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          🔒 <b>Désactivé et verrouillé.</b> L'envoi automatique d'argent depuis votre compte Mixx
          nécessite un compte marchand <b>CinetPay Payout</b> ou un contrat marchand T-Money/Moov
          (le *145# personnel exige votre PIN humain). Les règles de sécurité ci-dessous sont déjà
          prêtes pour ce jour-là.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Destinataires autorisés (numéros, séparés par des virgules)
            </label>
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              onBlur={() => saveRules({ allowedPayoutRecipients: recipients })}
              placeholder='["+228 71 69 24 01"]'
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400 mt-5">
            <input type="checkbox" disabled className="w-4 h-4" />
            Activer les payouts automatiques (verrouillé)
          </label>
        </div>
      </div>

      {/* Journal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <BellRing className="text-emerald-600" size={18} />
          <h2 className="font-bold text-gray-900">Journal d'audit & notifications</h2>
        </div>
        {log.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">
            Aucune transaction automatique pour l'instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Référence</th>
                  <th className="text-left p-3">Montant</th>
                  <th className="text-left p-3">Statut</th>
                  <th className="text-left p-3">Notification</th>
                  <th className="text-left p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.map((l) => {
                  const within =
                    l.status === "auto_approved" && now - new Date(l.createdAt).getTime() <= windowMs;
                  return (
                    <tr key={l.id}>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {format(new Date(l.createdAt), "d MMM HH:mm", { locale: fr })}
                      </td>
                      <td className="p-3 text-gray-600">{l.kind}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{l.reference}</td>
                      <td className="p-3 font-semibold text-emerald-700">{fcfa(l.amountFcfa)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            l.status === "auto_approved"
                              ? "bg-green-100 text-green-700"
                              : l.status === "reversed"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {l.status === "auto_approved"
                            ? "Auto ✅"
                            : l.status === "reversed"
                            ? "Annulée ↩️"
                            : l.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {l.notifyWaLink ? (
                          <a
                            href={l.notifyWaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 underline text-xs"
                          >
                            🔔 Voir
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        {within ? (
                          <button
                            onClick={() => reverse(l.id)}
                            disabled={saving}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> Annuler
                          </button>
                        ) : l.status === "auto_approved" ? (
                          <span className="text-xs text-gray-400">Fenêtre close</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
