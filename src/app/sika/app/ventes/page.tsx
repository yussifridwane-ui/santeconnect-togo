"use client";

import { useEffect, useState } from "react";
import { Plus, Minus, Trash2, Loader2, Check } from "lucide-react";

const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";

export default function SikaPOS() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = () => {
    Promise.all([fetch("/api/sika/products").then((r) => r.json()), fetch("/api/sika/customers").then((r) => r.json())])
      .then(([p, c]) => {
        setProducts(Array.isArray(p) ? p : []);
        setCustomers(Array.isArray(c) ? c : []);
      });
  };
  useEffect(load, []);

  const add = (id: number) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id: number) =>
    setCart((c) => {
      const q = (c[id] || 0) - 1;
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });

  const lines = Object.entries(cart).map(([id, qty]) => {
    const p = products.find((x) => x.id === parseInt(id));
    return p ? { productId: p.id, name: p.name, qty, unit: p.priceFcfa } : null;
  }).filter(Boolean) as any[];
  const total = lines.reduce((a, l) => a + l.unit * l.qty, 0);

  const checkout = async () => {
    if (lines.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/sika/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty })), customerId: customerId || null, method }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResult(d);
      setCart({});
      load();
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Caisse / Ventes</h1>

      {result && !result.error && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900">
          ✅ Vente de <b>{fcfa(result.totalFcfa)}</b> enregistrée, stock mis à jour.
          {result.waLink && (
            <a href={result.waLink} target="_blank" rel="noopener noreferrer" className="ml-2 underline font-bold text-emerald-700">
              💬 Envoyer le reçu WhatsApp
            </a>
          )}
        </div>
      )}
      {result?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">❌ {result.error}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 mb-3"
          />
          <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                disabled={p.stock <= 0}
                className="text-left p-3 rounded-xl border border-amber-100 hover:border-orange-400 hover:bg-orange-50 disabled:opacity-40 transition"
              >
                <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                <p className="text-xs text-gray-400">{p.category} · stock {p.stock}</p>
                <p className="text-sm font-bold text-orange-600 mt-1">{fcfa(p.priceFcfa)}</p>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-sm text-gray-400 col-span-2">Aucun produit. Ajoutez-en depuis « Produits & Stock ».</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 h-fit">
          <h2 className="font-bold text-gray-900 mb-3">🧾 Panier</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-400">Panier vide — touchez un produit.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{l.name}</p>
                    <p className="text-xs text-gray-400">{fcfa(l.unit)} × {l.qty}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => dec(l.productId)} className="p-1 bg-gray-100 rounded"><Minus size={12} /></button>
                    <span className="w-6 text-center font-bold">{l.qty}</span>
                    <button onClick={() => add(l.productId)} className="p-1 bg-gray-100 rounded"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Client de passage</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMethod("cash")} className={`py-2 rounded-lg text-sm font-bold border ${method === "cash" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500"}`}>Espèces</button>
              <button onClick={() => setMethod("mixx")} className={`py-2 rounded-lg text-sm font-bold border ${method === "mixx" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>Mixx by Yas</button>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="text-xl font-extrabold text-orange-600">{fcfa(total)}</span>
          </div>
          <button
            onClick={checkout}
            disabled={busy || lines.length === 0}
            className="w-full mt-3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Encaisser {total > 0 ? fcfa(total) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
