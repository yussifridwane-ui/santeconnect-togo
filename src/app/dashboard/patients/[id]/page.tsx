"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Printer,
  Loader2,
  Phone,
  MessageCircle,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import PatientFormModal, { PatientFull, ageFrom } from "@/components/PatientFormModal";
import PatientExamsSection from "@/components/PatientExamsSection";
import { useAuth } from "@/contexts/AuthContext";

function fdate(v?: string | Date | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy", { locale: fr });
}

function Field({ label, value, className = "" }: { label: string; value?: string | number | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{value ?? "—"}</p>
    </div>
  );
}

function SectionCard({ title, icon, badge, children }: { title: string; icon: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 print-section">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h2 className="font-bold text-emerald-800 uppercase tracking-wide text-sm">{title}</h2>
        {badge && <span className="ml-auto px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">{badge}</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

const MARITAL_LABELS: Record<string, string> = {
  celibataire: "Célibataire",
  marie: "Marié(e)",
  divorce: "Divorcé(e)",
  veuf: "Veuf / Veuve",
  "union-libre": "Union libre",
};

export default function PatientFilePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const { user } = useAuth();
  const [patient, setPatient] = useState<PatientFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [resettingCode, setResettingCode] = useState(false);
  const canResetCode = user?.role === "admin" || user?.role === "doctor";

  const resetDossierCode = async () => {
    if (!confirm(`Réinitialiser le code dossier de ${patient?.fullName || "ce patient"} ?\n\nSon ancien code sera effacé (personne ne peut le lire) ; il en créera un nouveau à sa prochaine connexion.`)) return;
    setResettingCode(true);
    try {
      const res = await fetch(`/api/patients/${id}/dossier-code`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      alert("✅ Code dossier réinitialisé. Le patient créera un nouveau code à sa prochaine connexion.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setResettingCode(false);
    }
  };

  const fetchPatient = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Impossible de charger la fiche");
      }
      setPatient(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPatient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const coverageExpired =
    patient?.coverageEnd && new Date(patient.coverageEnd) < new Date();

  const printFiche = () => {
    if (!patient) return;
    const w = window.open("", "_blank", "width=760,height=1000");
    if (!w) return;
    const row = (label: string, value?: string | number | null) =>
      `<tr><td style="color:#6b7280;padding:3px 12px 3px 0;vertical-align:top">${label}</td><td style="font-weight:600;padding:3px 0">${value || "—"}</td></tr>`;
    const section = (title: string, rows: string) =>
      `<h3 style="color:#065f46;font-size:13px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #10b981;padding-bottom:4px;margin:18px 0 8px">${title}</h3><table style="width:100%;font-size:13px">${rows}</table>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Fiche patient ${patient.recordNumber || ""} — SantéOnline</title>
      <style>body{font-family:system-ui,-apple-system,sans-serif;color:#111827;padding:32px;max-width:760px;margin:auto}
      .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #10b981;padding-bottom:12px}
      .muted{color:#6b7280;font-size:12px}</style></head><body>
      <div class="head">
        <div><b style="color:#065f46;font-size:20px">🩺 SantéOnline</b><div class="muted">Fiche patient confidentielle</div></div>
        <div style="text-align:right"><b>${patient.recordNumber || "—"}</b><div class="muted">Imprimée le ${format(new Date(), "dd/MM/yyyy")}</div></div>
      </div>
      <h2 style="margin:16px 0 2px">${patient.fullName || ""}</h2>
      <p class="muted">Âge : ${ageFrom(patient.dateOfBirth)} · Sexe : ${patient.gender === "male" ? "Homme" : patient.gender === "female" ? "Femme" : "—"} · Groupe : ${patient.bloodType || "—"}</p>
      ${section("🪪 Identité", row("Nom complet", patient.fullName) + row("Prénom(s)", patient.firstName) + row("Nom", patient.lastName) + row("Nom d'usage", patient.usageName) + row("Né(e) le", fdate(patient.dateOfBirth)) + row("Lieu de naissance", patient.placeOfBirth) + row("Nationalité", patient.nationality) + row("Pièce", `${patient.idType || "—"} ${patient.idNumber || ""}`))}
      ${section("📍 Coordonnées", row("Téléphone", patient.phone) + row("Tél. secondaire", patient.phoneSecondary) + row("WhatsApp", patient.whatsapp) + row("Pays", patient.country) + row("Région", patient.region) + row("Ville", patient.city) + row("Commune", patient.commune) + row("Quartier", patient.quartier) + row("Rue", patient.street) + row("N° maison", patient.houseNumber) + row("Repère", patient.landmark) + row("Adresse", patient.addressFull || patient.address))}
      ${section("👨‍👩‍👧 Situation familiale", row("Situation", MARITAL_LABELS[patient.maritalStatus || ""] || patient.maritalStatus) + row("Conjoint", patient.spouseName) + row("Tél. conjoint", patient.spousePhone) + row("Enfants", patient.childrenCount))}
      ${section("🚨 Contact d'urgence", row("Nom", patient.emergencyName || patient.emergencyContact) + row("Relation", patient.emergencyRelation) + row("Téléphone", patient.emergencyPhone) + row("Tél. 2", patient.emergencyPhoneSecondary) + row("WhatsApp", patient.emergencyWhatsapp) + row("Adresse", patient.emergencyAddress) + row("Ville", patient.emergencyCity))}
      ${section("💼 Profession", row("Profession", patient.profession) + row("Employeur", patient.employer) + row("Tél. pro", patient.workPhone) + row("E-mail pro", patient.workEmail) + row("Adresse pro", patient.workAddress) + row("Ville", patient.workCity))}
      ${section("🛡️ Assurance", row("Organisme", patient.insurerName) + row("N° assuré", patient.insuredNumber || patient.insuranceNumber) + row("N° carte", patient.insuranceCardNumber) + row("Couverture", patient.coverageType) + row("Début", fdate(patient.coverageStart)) + row("Expiration", fdate(patient.coverageEnd)) + row("Statut", patient.coverageStatus))}
      ${patient.medicalNotes ? section("📝 Notes médicales", `<tr><td colspan="2" style="color:#b91c1c;background:#fef2f2;padding:8px;border-radius:6px">${patient.medicalNotes}</td></tr>`) : ""}
      <p class="muted" style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:10px">Document confidentiel — SantéOnline · toute consultation de ce dossier est enregistrée dans le journal de sécurité.</p>
      <script>window.onload=function(){window.print();};<\/script></body></html>`);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="bg-white rounded-xl border border-red-100 p-8 text-center">
        <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-600 font-medium">{error || "Patient introuvable"}</p>
        <button onClick={() => router.push("/dashboard/patients")} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg">
          ← Retour aux patients
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push("/dashboard/patients")} className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
          <ArrowLeft size={16} /> Patients
        </button>
        <div className="flex-1" />
        <button onClick={printFiche} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium print:hidden">
          <Printer size={16} /> Imprimer la fiche
        </button>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Pencil size={16} /> Modifier
        </button>
        {canResetCode && (
          <button
            onClick={resetDossierCode}
            disabled={resettingCode}
            title="Efface le code secret du patient (il en recréera un nouveau)"
            className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium disabled:opacity-50"
          >
            {resettingCode ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Code dossier
          </button>
        )}
      </div>

      {/* En-tête patient */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {patient.fullName?.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{patient.fullName}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-emerald-100">
              <span className="font-mono bg-white/10 px-2 py-0.5 rounded">{patient.recordNumber || "Sans n° de dossier"}</span>
              <span>{ageFrom(patient.dateOfBirth)}</span>
              <span>{patient.gender === "male" ? "Homme" : patient.gender === "female" ? "Femme" : ""}</span>
              {patient.bloodType && <span>Groupe {patient.bloodType}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {patient.phone && (
              <a href={`tel:${patient.phone}`} className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium">
                <Phone size={15} /> Appeler
              </a>
            )}
            {patient.whatsapp && (
              <a href={`https://wa.me/${String(patient.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {(patient.coverageStatus === "expiree" || coverageExpired) && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={18} />
          <b>Assurance expirée</b>&nbsp;— vérifiez la couverture avant toute prestation.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Identité" icon="🪪">
          <Field label="Nom complet" value={patient.fullName} />
          <Field label="Prénom(s)" value={patient.firstName} />
          <Field label="Nom" value={patient.lastName} />
          <Field label="Nom d'usage" value={patient.usageName} />
          <Field label="Date de naissance" value={fdate(patient.dateOfBirth)} />
          <Field label="Âge" value={ageFrom(patient.dateOfBirth)} />
          <Field label="Lieu de naissance" value={patient.placeOfBirth} />
          <Field label="Nationalité" value={patient.nationality} />
          <Field label="Pièce d'identité" value={patient.idType ? `${patient.idType} · ${patient.idNumber || "—"}` : null} />
        </SectionCard>

        <SectionCard title="Coordonnées" icon="📍">
          <Field label="Téléphone principal" value={patient.phone} />
          <Field label="Tél. secondaire" value={patient.phoneSecondary} />
          <Field label="WhatsApp" value={patient.whatsapp} />
          <Field label="Pays" value={patient.country} />
          <Field label="Région / Préfecture" value={patient.region} />
          <Field label="Ville" value={patient.city} />
          <Field label="Commune" value={patient.commune} />
          <Field label="Quartier" value={patient.quartier} />
          <Field label="Rue" value={patient.street} />
          <Field label="N° maison" value={patient.houseNumber} />
          <Field label="Point de repère" value={patient.landmark} />
          <Field label="Adresse complète" value={patient.addressFull || patient.address} className="col-span-2 md:col-span-3" />
        </SectionCard>

        <SectionCard title="Situation familiale" icon="👨‍👩‍👧">
          <Field label="Situation" value={MARITAL_LABELS[patient.maritalStatus || ""] || patient.maritalStatus} />
          <Field label="Conjoint" value={patient.spouseName} />
          <Field label="Tél. conjoint" value={patient.spousePhone} />
          <Field label="Nombre d'enfants" value={patient.childrenCount} />
        </SectionCard>

        <SectionCard title="Contact d'urgence" icon="🚨">
          <Field label="Nom et prénom" value={patient.emergencyName || patient.emergencyContact} />
          <Field label="Relation" value={patient.emergencyRelation} />
          <Field label="Téléphone" value={patient.emergencyPhone} />
          <Field label="Tél. secondaire" value={patient.emergencyPhoneSecondary} />
          <Field label="WhatsApp" value={patient.emergencyWhatsapp} />
          <Field label="Adresse" value={patient.emergencyAddress} />
          <Field label="Ville" value={patient.emergencyCity} />
        </SectionCard>

        <SectionCard title="Profession" icon="💼">
          <Field label="Profession" value={patient.profession} />
          <Field label="Employeur" value={patient.employer} />
          <Field label="Tél. professionnel" value={patient.workPhone} />
          <Field label="E-mail professionnel" value={patient.workEmail} />
          <Field label="Adresse professionnelle" value={patient.workAddress} />
          <Field label="Ville" value={patient.workCity} />
        </SectionCard>

        <SectionCard
          title="Assurance"
          icon="🛡️"
          badge={patient.coverageStatus === "active" ? "Active ✓" : coverageExpired || patient.coverageStatus === "expiree" ? "Expirée" : undefined}
        >
          <Field label="Organisme" value={patient.insurerName} />
          <Field label="N° assuré" value={patient.insuredNumber || patient.insuranceNumber} />
          <Field label="N° de carte" value={patient.insuranceCardNumber} />
          <Field label="Type de couverture" value={patient.coverageType} />
          <Field label="Début" value={fdate(patient.coverageStart)} />
          <Field label="Expiration" value={fdate(patient.coverageEnd)} />
        </SectionCard>
      </div>

      {/* 🧪 Examens du dossier — demande, suivi, résultat, validation (V2.2) */}
      <PatientExamsSection patientId={id} />

      {patient.medicalNotes && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-5">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">📝 Notes médicales</p>
          <p className="text-sm text-red-700 whitespace-pre-wrap">{patient.medicalNotes}</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
        <ShieldCheck size={14} />
        Fiche créée le {fdate(patient.createdAt)} · Chaque consultation de ce dossier est enregistrée dans le journal de sécurité.
      </div>

      {showForm && (
        <PatientFormModal
          initial={patient}
          onClose={() => setShowForm(false)}
          onSaved={fetchPatient}
        />
      )}
    </div>
  );
}
