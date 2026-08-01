"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Loader2, LayoutDashboard, ShoppingCart, Package, Users, CreditCard, Store, Lock } from "lucide-react";

// Liens relatifs : fonctionnent sous /sika/app (santeonline) ET sous la racine de sikastock.tg
const NAV = [
  { href: "./", match: "/app", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "./ventes", match: "/ventes", label: "Caisse / Ventes", icon: ShoppingCart },
  { href: "./produits", match: "/produits", label: "Produits & Stock", icon: Package },
  { href: "./clients", match: "/clients", label: "Clients", icon: Users },
  { href: "./abonnement", match: "/abonnement", label: "Abonnement", icon: CreditCard },
];

export default function SikaAppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [shopName, setShopName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetch("/api/sika/shops").then((r) => r.json()).then(setData).catch(() => {});
    }
  }, [user]);

  const createShop = async () => {
    if (!shopName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/sika/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: shopName }),
    });
    const d = await res.json();
    setData(d);
    setCreating(false);
  };

  if (loading || (user && !data)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50/40">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }
  if (!user) return null;

  if (data && !data.shop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-5">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto bg-orange-500 rounded-2xl flex items-center justify-center text-3xl">🛒</div>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-4">Bienvenue sur SikaStock</h1>
          <p className="text-gray-500 mt-2 text-sm">Créez votre boutique et profitez de 14 jours d'essai Pro gratuits.</p>
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Nom de votre boutique (ex : Boutique Espoir)"
            className="w-full mt-5 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={createShop}
            disabled={creating}
            className="w-full mt-3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Store size={18} />}
            Créer ma boutique
          </button>
        </div>
      </div>
    );
  }

  const blocked = data?.state && !data.state.allowed && !pathname.endsWith("/abonnement");

  return (
    <div className="min-h-screen bg-amber-50/40 flex">
      <aside className="w-60 bg-gradient-to-b from-orange-600 to-amber-700 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-5 border-b border-white/10">
          <h1 className="font-extrabold text-lg">🛒 SikaStock</h1>
          <p className="text-xs text-amber-100 mt-0.5 truncate">{data?.shop?.name}</p>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${pathname.endsWith(n.match) ? "bg-white/20 font-semibold" : "text-amber-50 hover:bg-white/10"}`}
            >
              <n.icon size={18} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <Link href="https://santeonline.netlify.app/dashboard" className="text-xs text-amber-100 hover:text-white">← Espace SantéConnect</Link>
        </div>
      </aside>

      <div className="md:hidden fixed top-3 left-3 z-40 flex gap-1 bg-orange-600 rounded-xl p-1 shadow-lg">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`p-2 rounded-lg ${pathname.endsWith(n.match) ? "bg-white/25" : ""}`}>
            <n.icon size={16} />
          </Link>
        ))}
      </div>

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pt-16 md:pt-8">
        {data?.state?.status === "trialing" && (
          <div className="mb-4 px-4 py-2.5 bg-amber-100 border border-amber-300 rounded-xl text-sm text-amber-900">
            ⏳ Essai Pro : {data.state.daysLeft} j restants.{" "}
            <Link href="./abonnement" className="underline font-semibold">Choisir une formule</Link>
          </div>
        )}
        {blocked ? (
          <div className="max-w-md mx-auto mt-16 bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center">
            <div className="w-14 h-14 mx-auto bg-red-100 rounded-2xl flex items-center justify-center"><Lock className="text-red-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mt-4">Accès suspendu</h2>
            <p className="text-gray-500 text-sm mt-2">{data.state.message}</p>
            <Link href="./abonnement" className="block mt-5 py-3 bg-orange-500 text-white rounded-xl font-bold">
              Voir les formules & payer par Mixx
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
