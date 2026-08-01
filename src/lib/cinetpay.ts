// ============================================================
// Intégration CinetPay (Mobile Money Togo : Flooz & T-Money)
// Activez le mode réel en ajoutant dans vos variables d'env :
//   CINETPAY_API_KEY  (clé API v2)
//   CINETPAY_SITE_ID  (identifiant du site)
// Sans ces clés, le système passe en MODE DÉMO (paiement simulé).
// Documentation : https://docs.cinetpay.com
// ============================================================

const API_KEY = process.env.CINETPAY_API_KEY || "";
const SITE_ID = process.env.CINETPAY_SITE_ID || "";
const BASE = "https://api.cinetpay.com/v2";

export const cinetpayConfigured = Boolean(API_KEY && SITE_ID);

export interface CinetpayCreateInput {
  txId: string;
  amountFcfa: number;
  description: string;
  customerName: string;
  customerPhone: string;
  notifyUrl: string;
  returnUrl: string;
}

export async function createCinetpayPayment(input: CinetpayCreateInput): Promise<{
  paymentUrl: string;
  providerTxId: string;
}> {
  const res = await fetch(`${BASE}/payment/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: API_KEY,
      site_id: SITE_ID,
      transaction_id: input.txId,
      amount: input.amountFcfa,
      currency: "XOF",
      description: input.description,
      customer_name: input.customerName,
      customer_surname: "",
      customer_email: "",
      customer_phone_number: input.customerPhone,
      customer_address: "",
      customer_city: "",
      customer_country: "TG",
      notify_url: input.notifyUrl,
      return_url: input.returnUrl,
      channels: "MOBILE_MONEY",
      lang: "fr",
    }),
  });
  const data = await res.json();
  if (data.code !== "00" || !data.data?.payment_url) {
    throw new Error(data.message || "Erreur CinetPay lors de la création du paiement");
  }
  return { paymentUrl: data.data.payment_url, providerTxId: input.txId };
}

export async function verifyCinetpayPayment(txId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: API_KEY, site_id: SITE_ID, transaction_id: txId }),
  });
  const data = await res.json();
  const status = String(data.data?.status || "").toUpperCase();
  return ["ACCEPTED", "COMPLETED", "VALIDATED", "APPROVED"].includes(status);
}
