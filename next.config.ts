import type { NextConfig } from "next";

// 🛡️ AUDIT V2.8 — En-têtes de sécurité appliqués par le moteur Next.js
// lui-même (et non par netlify.toml). Raison : Netlify ignore les
// [[headers]] du fichier netlify.toml pour les pages et API servies par
// le runtime Next.js — les en-têtes fixés ici couvrent TOUT :
// pages SSR, routes /api/* et fichiers /_next/*.
const SECURITY_HEADERS: { key: string; value: string }[] = [
  // La page ne peut jamais être mise dans un iframe (anti-clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Interdit au navigateur de deviner un type de fichier (anti-MIME sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Référent minimal vers les sites externes (vie privée)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Protection XSS héritée pour les vieux navigateurs
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // HTTPS forcé pendant 1 an — plus aucune connexion en clair ensuite
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Aucun accès caméra/micro/géolocalisation/paiement par défaut
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Politique de contenu : scripts/styles/images UNIQUEMENT depuis notre
  // propre domaine (+ inline nécessaire à l'hydratation Next.js).
  // Aucun domaine externe, aucun iframe embarqué.
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'; " +
      "base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Appliqué à toutes les routes (pages, API, assets)
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
