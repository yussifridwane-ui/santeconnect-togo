"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, ShoppingCart, Banknote } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";

export default function SikaDashboard() {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ai, setAi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sika/sales").then((r) => r.json()),
      fetch("/api/sika/products").then((r) => r.json()),
      fetch("/api/sika/ai", { method: "POST" }).then((r) => r.json()),
    ])
      .then(([s, p, a]) => {
        setSales(Array.isArray(s) ? s : []);
        setProducts(Array.isArray(p) ? p : []);
        setAi(a);
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const startDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const salesToday = sales.filter((s) => new Date(s.createdAt) >= startDay);
  const caToday = salesToday.reduce((a, s) => a + s.totalFcfa, 0);
  const low = products.filter((p) => p.stock <= p.lowStock);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <Banknote className="text-orange-500" size={20} />
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{fcfa(caToday)}</p>
          <p className="text-xs text-gray-500">Ventes aujourd'hui</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <ShoppingCart className="text-orange-500" size={20} />
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{salesToday.length}</p>
          <p className="text-xs text-gray-500">Transactions du jour</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <TrendingUp className="text-emerald-600" size={20} />
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{ai?.projection ? fcfa(ai.projection) : "—"}</p>
          <p className="text-xs text-gray-500">Projection du mois (IA)</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <AlertTriangle className={low.length ? "text-red-500" : "text-gray-300"} size={20} />
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{low.length}</p>
          <p className="text-xs text-gray-500">Alertes stock</p>
        </div>
      </div>

      {/* Assistant IA */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="font-bold flex items-center gap-2"><Sparkles size={18} /> Assistant IA SikaStock</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-amber-50">
          {(ai?.insights || ["Chargement de l'analyse…"]).map((i: string, k: number) => (
            <li key={k}>{i}</li>
          ))}
        </ul>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm">
          <div className="p-4 border-b border-amber-100 font-bold text-gray-900">Dernières ventes</div>
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Chargement…</p>
          ) : sales.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">Aucune vente. Passez votre première vente depuis « Caisse / Ventes ».</p>
          ) : (
            <div className="divide-y divide-amber-50">
              {sales.slice(0, 6).map((s) => (
                <div key={s.id} className="p-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{s.items?.length || 0} article(s) · {s.method === "mixx" ? "Mixx" : "Espèces"}</p>
                    <p className="text-xs text-gray-400">{format(new Date(s.createdAt), "d MMM HH:mm", { locale: fr })}</p>
                  </div>
                  <span className="font-bold text-orange-600">{fcfa(s.totalFcfa)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm">
          <div className="p-4 border-b border-amber-100 font-bold text-gray-900">Stock à réapprovisionner</div>
          {low.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">✅ Tous les stocks sont au-dessus des seuils.</p>
          ) : (
            <div className="divide-y divide-amber-50">
              {low.map((p) => (
                <div key={p.id} className="p-3 flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{p.stock} restants</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
