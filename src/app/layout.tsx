import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { headers } from "next/headers";

// Titre adapté au domaine visité : SikaStock sur sikastock.*, SantéConnect ailleurs
export async function generateMetadata(): Promise<Metadata> {
  let host = "";
  try {
    const h = await headers();
    host = h.get("host") || "";
  } catch {
    host = "";
  }

  if (host.startsWith("sikastock")) {
    return {
      title: "SikaStock — Gestion de commerce",
      description:
        "Le SaaS tout-en-un pour gérer votre boutique au Togo : stock, caisse, clients, reçus WhatsApp et conseils IA.",
      applicationName: "SikaStock",
    };
  }

  return {
    title: "SantéConnect Togo — Gestion de Santé",
    description:
      "Plateforme de messagerie et rendez-vous automatiques pour les cliniques, laboratoires et hôpitaux au Togo.",
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
