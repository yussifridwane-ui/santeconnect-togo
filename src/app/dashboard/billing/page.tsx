"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  CreditCard,
  Check,
  Loader2,
  Smartphone,
  Lock,
  Sparkles,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BillingStatus {
  subscription: any;
  state: {
    allowed: boolean;
    status: "trialing" | "active" | "blocked";
    daysLeft: number | null;
    renewalDate: string | null;
    message: string;
  };
  usage: { patients: number; users: number };
  plan: any;
  cinetpayConfigured: boolean;
}

interface Payment {
  id: number;
  planId: string;
  billingCycle: string;
  amountFcfa: number;
  method: string | null;
  status: string;
  createdAt: string;
}

interface PendingPayment extends Payment {
  facilityName: string | null;
  providerTxId: string | null;
}

const PLAN_CARDS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Pour démarrer votre cabinet",
    monthly: 12500,
    yearly: 125000,
    features: ["150 patients", "2 utilisateurs", "Rendez-vous illimités", "Messagerie & dossiers"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Le choix des cabinets actifs",
    monthly: 30000,
    yearly: 300000,
    highlight: true,
    features: ["600 patients", "6 utilisateurs", "Rappels WhatsApp auto", "Planification auto", "Statistiques"],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Cliniques, labos & hôpitaux",
    monthly: 60000,
    yearly: 600000,
    features: ["Patients illimités", "Utilisateurs illimités", "WhatsApp + auto", "Multi-sites (3)", "Support prioritaire"],
  },
];

const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";
const methodLabel = (m: string | null) =>
  m === "flooz" ? "Flooz" : "Mixx by Yas";

export default function BillingPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState("");
  const [instructions, setInstructions] = useState<any>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [txRef, setTxRef] = useState("");
  const [declareRes, setDeclareRes] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [s, p] = await Promise.all([
        fetch("/api/billing/status").then((r) => r.json()),
        fetch("/api/billing/payments").then((r) => r.json()),
      ]);
      setStatus(s);
      setPaymentsList(Array.isArray(p) ? p : []);
      if (user?.role === "admin") {
        const pend = await fetch("/api/billing/pending").then((r) => r.json());
        setPending(Array.isArray(pend) ? pend : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    setInstructions(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan, cycle, method: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInstructions(data.instructions);
      setPaymentId(data.paymentId || null);
      setDeclareRes(null);
      setTxRef("");
      setToast("📲 Instructions Mixx by Yas générées ci-dessous.");
      await load();
    } catch (e: any) {
      setToast("❌ " + (e.message || "Échec"));
    } finally {
      setPaying(false);
      setTimeout(() => setToast(""), 7000);
    }
  };

  const handleDeclare = async () => {
    setPaying(true);
    try {
      const res = await fetch("/api/billing/declare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, txRef }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDeclareRes(d);
      await load();
    } catch (e: any) {
      setToast("❌ " + (e.message || "Erreur"));
    } finally {
      setPaying(false);
      setTimeout(() => setToast(""), 6000);
    }
  };

  const confirmPayment = async (id: number) => {
    try {
      const res = await fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast("✅ Paiement validé, abonnement du cabinet activé.");
      await load();
    } catch (e: any) {
      setToast("❌ " + (e.message || "Erreur"));
    } finally {
      setTimeout(() => setToast(""), 6000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const st = status?.state;
  const plan = status?.plan;
  const usage = status?.usage;
  const selected = PLAN_CARDS.find((p) => p.id === selectedPlan)!;
  const amount = cycle === "monthly" ? selected.monthly : selected.yearly;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium max-w-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="text-emerald-700" size={24} />
          Facturation & Abonnement
        </h1>
        <p className="text-gray-500 mt-1">
          Payez votre abonnement par transfert <b>Mixx by Yas</b>, validé sous 24 h.
        </p>
      </div>

      {/* Validation admin des paiements manuels */}
      {user?.role === "admin" && pending.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
            <ShieldCheck className="text-amber-600" size={18} />
            Paiements Mixx by Yas à valider ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 rounded-xl px-4 py-3">
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">
                    {p.facilityName || "Cabinet"} — {fcfa(p.amountFcfa)} ({p.planId} {p.billingCycle === "yearly" ? "annuel" : "mensuel"})
                  </p>
                  <p className="text-xs text-gray-500">
                    Réf : <b>{p.providerTxId}</b> · {format(new Date(p.createdAt), "d MMM HH:mm", { locale: fr })}
                  </p>
                </div>
                <button
                  onClick={() => confirmPayment(p.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-1"
                >
                  <Check size={14} /> J'ai reçu l'argent
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statut actuel */}
      {st && (
        <div
          className={`rounded-2xl p-5 border shadow-sm ${
            st.status === "blocked"
              ? "bg-red-50 border-red-200"
              : st.status === "trialing"
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Formule actuelle : <span className="text-gray-900">{plan?.name}</span>
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {st.status === "trialing" &&
                  `Essai gratuit Pro — ${st.daysLeft} jour${(st.daysLeft || 0) > 1 ? "s" : ""} restant${(st.daysLeft || 0) > 1 ? "s" : ""}`}
                {st.status === "active" &&
                  `Actif jusqu'au ${st.renewalDate ? format(new Date(st.renewalDate), "d MMMM yyyy", { locale: fr }) : ""}`}
                {st.status === "blocked" && "Accès suspendu — paiement requis"}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold text-white ${
                st.status === "blocked" ? "bg-red-600" : st.status === "trialing" ? "bg-amber-500" : "bg-emerald-600"
              }`}
            >
              {st.status === "trialing" ? "ESSAI GRATUIT" : st.status === "active" ? "ACTIF" : "SUSPENDU"}
            </span>
          </div>
          {usage && plan && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[
                { label: "Patients", used: usage.patients, max: plan.maxPatients },
                { label: "Utilisateurs", used: usage.users, max: plan.maxUsers },
              ].map((b, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{b.label}</span>
                    <span>{b.used} / {b.max >= 999999 ? "∞" : b.max}</span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, (b.used / (b.max >= 999999 ? b.used + 1 : b.max)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Choix cycle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Choisissez votre formule</h2>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium ${cycle === "monthly" ? "bg-white shadow-sm text-emerald-700" : "text-gray-600"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium ${cycle === "yearly" ? "bg-white shadow-sm text-emerald-700" : "text-gray-600"}`}
          >
            Annuel <span className="text-emerald-600 text-xs font-bold">-2 mois</span>
          </button>
        </div>
      </div>

      {/* Cartes formules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_CARDS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPlan(p.id)}
            className={`text-left rounded-2xl p-5 border-2 transition-all bg-white ${
              selectedPlan === p.id ? "border-emerald-600 shadow-lg ring-2 ring-emerald-100" : "border-gray-100 shadow-sm hover:border-emerald-200"
            } ${p.highlight ? "relative" : ""}`}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-5 px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                <Sparkles size={10} /> POPULAIRE
              </span>
            )}
            <h3 className="font-bold text-gray-900">{p.name}</h3>
            <p className="text-xs text-gray-500">{p.tagline}</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-3">
              {fcfa(cycle === "monthly" ? p.monthly : p.yearly)}
              <span className="text-xs font-medium text-gray-400"> /{cycle === "monthly" ? "mois" : "an"}</span>
            </p>
            <ul className="mt-4 space-y-1.5">
              {p.features.map((f, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className={`mt-4 py-2 rounded-lg text-center text-sm font-semibold ${selectedPlan === p.id ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
              {selectedPlan === p.id ? "Sélectionnée ✓" : "Choisir"}
            </div>
          </button>
        ))}
      </div>

      {/* Paiement Mixx by Yas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Smartphone className="text-blue-600" size={18} />
          Paiement par Mixx by Yas
        </h3>

        <div className="rounded-xl border-2 border-blue-500 bg-blue-50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Phone size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-blue-900">Mixx by Yas (ex T-Money)</p>
            <p className="text-xs text-blue-700">
              Transfert USSD via #145# — l'abonnement est activé après validation par l'administrateur (sous 24 h).
            </p>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={paying}
          className="mt-5 w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {paying ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}
          Générer les instructions de paiement ({fcfa(amount)})
        </button>

        {instructions && (
          <div className="mt-5 bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
            <h4 className="font-bold text-blue-900 mb-4 text-lg">📲 Comment payer par Mixx by Yas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase font-semibold">Montant exact à envoyer</p>
                <p className="text-xl font-extrabold text-blue-700">{fcfa(instructions.amountFcfa)}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase font-semibold">Numéro receveur (Mixx by Yas)</p>
                <p className="text-xl font-extrabold text-blue-700">{instructions.number}</p>
                <p className="text-xs text-gray-500">{instructions.beneficiary}</p>
              </div>
            </div>
            <ol className="space-y-2 mb-4">
              {(instructions.steps || []).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm text-blue-900">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm text-blue-900">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(instructions.steps || []).length + 1}
                </span>
                <span className="pt-0.5">
                  Conservez votre référence de commande :{" "}
                  <b className="bg-white px-2 py-0.5 rounded">{instructions.reference}</b>
                </span>
              </li>
            </ol>
            <p className="text-xs text-blue-800 bg-white/70 rounded-lg p-3">
              ✅ Une fois le transfert effectué, déclarez votre paiement ci-dessous. Selon les règles du
              <b> Centre d'automatisation</b>, l'abonnement s'active immédiatement (vous êtes notifié,
              annulation possible 1 h) ou passe en validation manuelle si un seuil est dépassé.
            </p>
            <div className="mt-3 bg-white rounded-lg p-3">
              <label className="text-xs font-semibold text-gray-500 uppercase">
                N° de transaction Mixx (reçu SMS)
              </label>
              <input
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
                placeholder="Ex : 240815123456"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleDeclare}
                disabled={paying}
                className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                J'ai payé — déclarer le paiement
              </button>
              {declareRes && (
                <p
                  className={`mt-2 text-sm rounded-lg p-3 ${
                    declareRes.autoApproved
                      ? "bg-green-50 text-green-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {declareRes.autoApproved ? "⚡ " : "⏳ "}
                  {declareRes.message}
                  {declareRes.reason ? ` (${declareRes.reason})` : ""}
                  {declareRes.waLink && (
                    <>
                      {" "}
                      <a href={declareRes.waLink} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                        🔔 Ouvrir la notification WhatsApp
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Historique des paiements</h3>
        </div>
        {paymentsList.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">Aucun paiement pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Formule</th>
                  <th className="text-left p-3">Montant</th>
                  <th className="text-left p-3">Moyen</th>
                  <th className="text-left p-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentsList.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 text-gray-600">{format(new Date(p.createdAt), "d MMM yyyy HH:mm", { locale: fr })}</td>
                    <td className="p-3 font-medium text-gray-900 capitalize">{p.planId} ({p.billingCycle === "yearly" ? "annuel" : "mensuel"})</td>
                    <td className="p-3 font-semibold text-emerald-700">{fcfa(p.amountFcfa)}</td>
                    <td className="p-3 text-gray-600">{methodLabel(p.method)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${p.status === "succeeded" ? "bg-green-100 text-green-700" : p.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {p.status === "succeeded" ? "Payé" : p.status === "pending" ? "En attente" : "Échoué"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
