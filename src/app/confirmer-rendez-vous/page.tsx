"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, CalendarX } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AptInfo {
  title: string;
  scheduledDate: string;
  doctorName?: string | null;
  facilityName?: string | null;
  patientName?: string | null;
}

function ConfirmerPage() {
  const searchParams = useSearchParams();
  const t = searchParams.get("t") || "";
  /* 🗳️ Sondage direct depuis le message (e-mail/SMS/WhatsApp) : &r=oui | &r=non */
  const rParam = searchParams.get("r") || "";
  const [state, setState] = useState<"loading" | "confirmed" | "declined" | "error">("loading");
  const [apt, setApt] = useState<AptInfo | null>(null);
  const [error, setError] = useState("");

  const respond = async (response: "confirmed" | "declined") => {
    setState("loading");
    try {
      const res = await fetch("/api/rdv-lien", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t, response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ce lien n'est plus valide.");
      setApt(data.appointment);
      setState(data.response === "declined" ? "declined" : "confirmed");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };

  useEffect(() => {
    if (t) respond(rParam === "non" ? "declined" : "confirmed");
    else {
      setError("Lien incomplet — ouvre-le depuis le message reçu (e-mail, SMS ou WhatsApp).");
      setState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, rParam]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-md w-full p-8 text-center">
        <p className="text-emerald-700 font-bold text-sm mb-6">🩺 SantéOnline</p>

        {state === "loading" && (
          <>
            <Loader2 size={40} className="animate-spin text-emerald-600 mx-auto" />
            <p className="text-gray-600 mt-4 text-sm">Confirmation en cours…</p>
          </>
        )}

        {state === "confirmed" && apt && (
          <>
            <CheckCircle2 size={56} className="text-emerald-600 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Présence confirmée ✅</h1>
            <p className="text-gray-600 text-sm mt-2">
              Merci {apt.patientName || ""} ! Votre rendez-vous est bien confirmé :
            </p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-4 text-sm text-left space-y-1.5">
              <p>📋 <b>{apt.title}</b></p>
              <p>📅 {format(new Date(apt.scheduledDate), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
              {apt.doctorName && <p>🩺 Dr {apt.doctorName}</p>}
              {apt.facilityName && <p>🏥 {apt.facilityName}</p>}
            </div>
            <p className="text-xs text-gray-400 mt-4">À demain ! L'équipe vous attend.</p>
          </>
        )}

        {state === "declined" && apt && (
          <>
            <CalendarX size={56} className="text-amber-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Empêchement signalé</h1>
            <p className="text-gray-600 text-sm mt-2">
              Votre centre de santé a été informé que vous ne pourrez pas venir le{" "}
              {format(new Date(apt.scheduledDate), "d MMMM yyyy", { locale: fr })}.
              Contactez-le pour choisir une nouvelle date.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle size={56} className="text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-gray-900 mt-4">Oups…</h1>
            <p className="text-gray-600 text-sm mt-2">{error}</p>
          </>
        )}

        {state === "confirmed" && apt && (
          <button
            onClick={() => respond("declined")}
            className="mt-6 text-xs text-red-500 underline hover:text-red-600"
          >
            Finalement, je ne pourrai pas venir →
          </button>
        )}
        <a href="/" className="block mt-6 text-xs text-emerald-700 font-semibold hover:underline">
          ← Retour à SantéOnline
        </a>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ConfirmerPage />
    </Suspense>
  );
}
