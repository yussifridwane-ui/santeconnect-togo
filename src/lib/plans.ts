// ============================================================
// Grille tarifaire SantéConnect Togo (FCFA)
// Modifiez les prix / limites ici : tout le système suit.
// ============================================================

export type PlanId = "starter" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthlyFcfa: number;
  priceYearlyFcfa: number;
  maxPatients: number;
  maxUsers: number;
  whatsappReminders: boolean;
  autoSchedule: boolean;
  multiSite: boolean;
  prioritySupport: boolean;
  features: string[];
  highlight?: boolean;
}

export const UNLIMITED = 999999;
export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Pour démarrer votre cabinet",
    priceMonthlyFcfa: 12500,
    priceYearlyFcfa: 125000,
    maxPatients: 150,
    maxUsers: 2,
    whatsappReminders: false,
    autoSchedule: false,
    multiSite: false,
    prioritySupport: false,
    features: [
      "150 patients maximum",
      "2 utilisateurs",
      "Rendez-vous illimités",
      "Messagerie interne",
      "Dossiers médicaux",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Le choix des cabinets actifs",
    priceMonthlyFcfa: 30000,
    priceYearlyFcfa: 300000,
    maxPatients: 600,
    maxUsers: 6,
    whatsappReminders: true,
    autoSchedule: true,
    multiSite: false,
    prioritySupport: false,
    highlight: true,
    features: [
      "600 patients",
      "6 utilisateurs",
      "Rappels WhatsApp automatiques",
      "Planification automatique",
      "Statistiques & facturation",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    tagline: "Cliniques, labos & hôpitaux",
    priceMonthlyFcfa: 60000,
    priceYearlyFcfa: 600000,
    maxPatients: UNLIMITED,
    maxUsers: UNLIMITED,
    whatsappReminders: true,
    autoSchedule: true,
    multiSite: true,
    prioritySupport: true,
    features: [
      "Patients illimités",
      "Utilisateurs illimités",
      "WhatsApp + planification auto",
      "Multi-sites (3 établissements)",
      "Support prioritaire",
    ],
  },
};

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro, PLANS.business];

export function getPlan(id: string): Plan {
  return PLANS[(id as PlanId)] || PLANS.pro;
}

export function formatFcfa(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/\u202f/g, " ") + " F CFA";
}
