/**
 * Hook de démarrage Next.js — lance les migrations idempotentes SantéOnline.
 * Jamais bloquant : en cas d'erreur, l'application démarre quand même.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureMigrated } = await import("@/db/migrate");
    ensureMigrated().catch((e) => console.error("[instrumentation] migrations:", e));
  }
}
