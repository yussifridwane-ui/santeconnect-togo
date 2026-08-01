"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Smartphone } from "lucide-react";

const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";
const PLANS = [
  { id: "pro", name: "Pro", price: 10000, features: ["Produits illimités", "Reçus WhatsApp", "Assistant IA", "Paiement Mixx by Yas"] },
  { id: "business", name: "Business", price: 25000, features: ["Tout Pro", "Multi-boutiques", "Support prioritaire"] },
];

export default function SikaBilling() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState("pro");
  const [instructions, setInstructions] = useState<any>(null);
  const [txRef, setTxRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/sika/billing").then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  const getInstructions = async () => {
    setBusy(true);
    const res = await fetch("/api/sika/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: selected }) });
    const d = await res.json();
    setInstructions(d.instructions);
    setBusy(false);
  };

  const declare = async () => {
    setBusy(true);
    const res = await fetch("/api/sika/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "declare", plan: selected, txRef }) });
    const d = await res.json();
    setMsg(d.message || d.error || "");
    setBusy(false);
    load();
  };

  if (!data) return <div className="p-10"><Loader2 className="animate-spin text-orange-500" /></div>;
  const st = data.state;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Abonnement SikaStock</h1>

      <div className={`rounded-2xl p-5 border ${st.allowed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
        <p className="font-bold text-gray-900">Formule actuelle : {data.sub?.plan === "free" ? "Découverte" : (data.sub?.plan || "—")}</p>
        <p className="text-sm text-gray-600 mt-1">{st.message}</p>
        <p className="text-xs text-gray-500 mt-1">Produits utilisés : {data.usage?.products} / {data.plans?.[data.sub?.plan]?.maxProducts >= 999999 ? "∞" : data.plans?.[data.sub?.plan]?.maxProducts || 30}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {PLANS.map((p) => (
          <button key={p.id} onClick={() => setSelected(p.id)} className={`text-left rounded-2xl p-5 border-2 bg-white ${selected === p.id ? "border-orange-500 shadow-lg" : "border-amber-100"}`}>
            <h3 className="font-bold text-gray-900">{p.name}</h3>
            <p className="text-2xl font-extrabold text-orange-600 mt-1">{fcfa(p.price)}<span className="text-xs text-gray-400 font-medium"> / mois</span></p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              {p.features.map((f, i) => <li key={i} className="flex gap-2"><Check size={14} className="text-emerald-600 mt-0.5" /> {f}</li>)}
            </ul>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Smartphone className="text-blue-600" size={18} /> Paiement par Mixx by Yas</h3>
        <button onClick={getInstructions} disabled={busy} className="mt-3 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">
          Générer les instructions ({fcfa(PLANS.find((p) => p.id === selected)!.price)})
        </button>

        {instructions && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <p className="font-bold">Montant : {fcfa(instructions.amountFcfa)} → {instructions.number} ({instructions.beneficiary})</p>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              {instructions.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="N° transaction Mixx (reçu SMS)" className="px-3 py-2 border rounded-lg flex-1 min-w-[180px]" />
              <button onClick={declare} disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-50">✅ J'ai payé — activer</button>
            </div>
            {msg && <p className="mt-2 font-semibold text-emerald-800">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
