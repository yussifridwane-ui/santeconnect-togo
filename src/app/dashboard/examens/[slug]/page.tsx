"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * V2.2 — La bibliothèque « cours » a été retirée sur décision du fondateur.
 * Les examens vivent désormais DANS LE DOSSIER DE CHAQUE PATIENT.
 * (Ancienne page neutralisée : redirection douce vers le tableau de bord.)
 */
export default function ExamRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
