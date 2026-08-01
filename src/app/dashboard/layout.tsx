"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Loader2, Lock, CreditCard } from "lucide-react";

interface BillingState {
  allowed: boolean;
  status: "trialing" | "active" | "blocked";
  daysLeft: number | null;
  message: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [billing, setBilling] = useState<BillingState | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role !== "patient" && user.facilityId) {
      fetch("/api/billing/status")
        .then((r) => r.json())
        .then((d) => {
          if (d && d.state) setBilling(d.state);
        })
        .catch(() => {});
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-8 h-8 text-emerald-600" />
      </div>
    );
  }

  if (!user) return null;

  const isStaff = user.role !== "patient";
  const blocked =
    isStaff && billing && !billing.allowed && pathname !== "/dashboard/billing";

  if (blocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-red-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-2xl flex items-center justify-center mb-5">
            <Lock size={28} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Accès suspendu</h1>
          <p className="text-gray-600 mt-3">{billing?.message}</p>
          <p className="text-sm text-gray-400 mt-2">
            Vos données restent conservées en toute sécurité. Réactivez votre abonnement en
            quelques secondes par Flooz ou T-Money.
          </p>
          <button
            onClick={() => router.push("/dashboard/billing")}
            className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <CreditCard size={18} />
            Voir les formules & payer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          {isStaff && billing?.status === "trialing" && (
            <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex flex-wrap items-center justify-between gap-2">
              <span>
                ⏳ <b>Essai gratuit Pro</b> — {billing.daysLeft} jour
                {(billing.daysLeft || 0) > 1 ? "s" : ""} restant
                {(billing.daysLeft || 0) > 1 ? "s" : ""}. Après l'essai, choisissez une formule
                payante par Flooz ou T-Money.
              </span>
              <button
                onClick={() => router.push("/dashboard/billing")}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold"
              >
                Choisir une formule
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
