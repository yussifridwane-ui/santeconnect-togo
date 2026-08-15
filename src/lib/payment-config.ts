// ============================================================
// Coordonnées de réception des paiements Mobile Money manuels.
// Actuellement : Mixx by Yas (T-Money) uniquement.
// Personnalisez via les variables d'environnement Netlify :
//   TMONEY_NUMBER (ou MIXX_NUMBER), PAYMENT_BENEFICIARY
// Le jour où Flooz sera disponible : ENABLE_FLOOZ=true + FLOOZ_NUMBER
// ============================================================

export const PAYOUT = {
  mixxNumber:
    process.env.TMONEY_NUMBER ||
    process.env.MIXX_NUMBER ||
    "+228 71 69 24 01",
  beneficiary:
    process.env.PAYMENT_BENEFICIARY || "Ridwane Issifou — SantéOnline Togo",
  floozEnabled: process.env.ENABLE_FLOOZ === "true",
  floozNumber: process.env.FLOOZ_NUMBER || "",
};

// Étapes précises de transfert Mixx by Yas (USSD #145#)
export function mixxUssdSteps(number: string, amountFcfa: number): string[] {
  return [
    "Composez #145# puis appuyez sur Appel",
    "Sélectionnez « Envoyer de l'argent »",
    `Saisissez le numéro receveur : ${number}`,
    `Saisissez le montant exact : ${amountFcfa.toLocaleString("fr-FR")} F CFA`,
    "Validez la transaction avec votre code PIN Mixx by Yas",
  ];
}
