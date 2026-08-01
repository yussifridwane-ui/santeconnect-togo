"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";

const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";

export default function SikaProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Général", priceFcfa: "", costFcfa: "", stock: "", lowStock: "5" });

  const load = () => fetch("/api/sika/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/sika/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return alert(d.error);
    setForm({ name: "", category: "Général", priceFcfa: "", costFcfa: "", stock: "", lowStock: "5" });
    setShow(false);
    load();
  };

  const del = async (id: number) => {
    if (!confirm("Supprimer ce produit ?")) return;
    await fetch(`/api/sika/products/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produits & Stock</h1>
        <button onClick={() => setShow(!show)} className="px-4 py-2.5 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 text-sm">
          <Plus size={16} /> Ajouter un produit
        </button>
      </div>

      {show && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 grid sm:grid-cols-3 gap-3">
          <input required placeholder="Nom du produit *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-lg sm:col-span-2" />
          <input placeholder="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input required type="number" placeholder="Prix de vente (F) *" value={form.priceFcfa} onChange={(e) => setForm({ ...form, priceFcfa: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input type="number" placeholder="Coût d'achat (F)" value={form.costFcfa} onChange={(e) => setForm({ ...form, costFcfa: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input type="number" placeholder="Stock initial" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input type="number" placeholder="Seuil d'alerte" value={form.lowStock} onChange={(e) => setForm({ ...form, lowStock: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <button disabled={busy} className="py-2 bg-orange-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Enregistrer
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">Produit</th>
              <th className="text-left p-3">Catégorie</th>
              <th className="text-left p-3">Prix</th>
              <th className="text-left p-3">Coût</th>
              <th className="text-left p-3">Stock</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-3 font-semibold text-gray-900">{p.name}</td>
                <td className="p-3 text-gray-500">{p.category}</td>
                <td className="p-3 font-bold text-orange-600">{fcfa(p.priceFcfa)}</td>
                <td className="p-3 text-gray-500">{fcfa(p.costFcfa)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${p.stock <= p.lowStock ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {p.stock}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => del(p.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Aucun produit. Ajoutez votre premier article.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
