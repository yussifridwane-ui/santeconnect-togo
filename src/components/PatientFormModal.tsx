"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";

/* Fiche patient complète SantéOnline — tous les champs sauf « Nom complet » sont facultatifs */
export interface PatientFull {
  id?: number;
  userId?: number;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  bloodType?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  insuranceNumber?: string | null;
  medicalNotes?: string | null;
  recordNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  usageName?: string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  photoUrl?: string | null;
  phoneSecondary?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  commune?: string | null;
  quartier?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  landmark?: string | null;
  addressFull?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  spousePhone?: string | null;
  childrenCount?: number | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhoneSecondary?: string | null;
  emergencyWhatsapp?: string | null;
  emergencyAddress?: string | null;
  emergencyCity?: string | null;
  profession?: string | null;
  employer?: string | null;
  workPhone?: string | null;
  workEmail?: string | null;
  workAddress?: string | null;
  workCity?: string | null;
  insurerName?: string | null;
  insuredNumber?: string | null;
  insuranceCardNumber?: string | null;
  coverageType?: string | null;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  coverageStatus?: string | null;
  createdAt?: string | Date | null;
}

const EMPTY: Record<string, string> = {
  fullName: "", email: "", phone: "", dateOfBirth: "", gender: "", bloodType: "",
  address: "", emergencyContact: "", emergencyPhone: "", insuranceNumber: "", medicalNotes: "",
  firstName: "", lastName: "", usageName: "", placeOfBirth: "", nationality: "Togolaise",
  idType: "", idNumber: "", phoneSecondary: "", whatsapp: "", country: "Togo",
  region: "", city: "", commune: "", quartier: "", street: "", houseNumber: "", landmark: "",
  addressFull: "", maritalStatus: "", spouseName: "", spousePhone: "", childrenCount: "",
  emergencyName: "", emergencyRelation: "", emergencyPhoneSecondary: "", emergencyWhatsapp: "",
  emergencyAddress: "", emergencyCity: "", profession: "", employer: "", workPhone: "",
  workEmail: "", workAddress: "", workCity: "", insurerName: "", insuredNumber: "",
  insuranceCardNumber: "", coverageType: "", coverageStart: "", coverageEnd: "", coverageStatus: "",
};

export function ageFrom(dob?: string | Date | null): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  let age = new Date().getFullYear() - d.getFullYear();
  const m = new Date().getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--;
  return age >= 0 ? `${age} ans` : "—";
}

interface Props {
  initial?: PatientFull | null; // null/undefined = création
  onClose: () => void;
  onSaved: () => void;
}

export default function PatientFormModal({ initial, onClose, onSaved }: Props) {
  const editing = !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f = { ...EMPTY };
    if (initial) {
      for (const k of Object.keys(f)) {
        const v = (initial as Record<string, unknown>)[k];
        if (v !== null && v !== undefined) {
          if (["dateOfBirth", "coverageStart", "coverageEnd"].includes(k)) {
            const d = new Date(v as string);
            f[k] = isNaN(d.getTime()) ? String(v).slice(0, 10) : format(d, "yyyy-MM-dd");
          } else {
            f[k] = String(v);
          }
        }
      }
    }
    return f;
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/patients/${initial!.id}` : "/api/patients", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";
  const Section = ({ title, icon }: { title: string; icon: string }) => (
    <div className="sm:col-span-2 mt-2 first:mt-0">
      <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wide border-b border-emerald-100 pb-1">
        {icon} {title}
      </h3>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? "Modifier la fiche patient" : "Nouveau patient"}
            </h2>
            {editing && initial?.recordNumber && (
              <p className="text-xs text-emerald-700 font-mono mt-0.5">Dossier n° {initial.recordNumber}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Identité" icon="🪪" />
            <div>
              <label className={labelCls}>Nom complet *</label>
              <input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nom d'usage</label>
              <input value={form.usageName} onChange={(e) => set("usageName", e.target.value)} className={inputCls} placeholder="Ex. nom de mariage" />
            </div>
            <div>
              <label className={labelCls}>Nom (de famille)</label>
              <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Prénom(s)</label>
              <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date de naissance</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inputCls} />
              <p className="text-xs text-emerald-700 mt-1">Âge calculé : <b>{ageFrom(form.dateOfBirth)}</b></p>
            </div>
            <div>
              <label className={labelCls}>Lieu de naissance</label>
              <input value={form.placeOfBirth} onChange={(e) => set("placeOfBirth", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sexe</label>
              <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
                <option value="">Sélectionner</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nationalité</label>
              <input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Groupe sanguin</label>
              <select value={form.bloodType} onChange={(e) => set("bloodType", e.target.value)} className={inputCls}>
                <option value="">Sélectionner</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Type de pièce d'identité</label>
              <select value={form.idType} onChange={(e) => set("idType", e.target.value)} className={inputCls}>
                <option value="">Sélectionner</option>
                <option>Carte nationale d'identité</option>
                <option>Carte d'électeur</option>
                <option>Passeport</option>
                <option>Permis de conduire</option>
                <option>Acte de naissance</option>
                <option>Autre</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>N° de pièce d'identité</label>
              <input value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" required={!editing} value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} placeholder={editing ? "(inchangé si vide)" : ""} />
            </div>

            <Section title="Coordonnées" icon="📍" />
            <div>
              <label className={labelCls}>Téléphone principal</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="+228 …" />
            </div>
            <div>
              <label className={labelCls}>Téléphone secondaire</label>
              <input value={form.phoneSecondary} onChange={(e) => set("phoneSecondary", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inputCls} placeholder="228 …" />
            </div>
            <div>
              <label className={labelCls}>Pays</label>
              <input value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Région / Préfecture</label>
              <input value={form.region} onChange={(e) => set("region", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ville</label>
              <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Commune</label>
              <input value={form.commune} onChange={(e) => set("commune", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Quartier</label>
              <input value={form.quartier} onChange={(e) => set("quartier", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rue</label>
              <input value={form.street} onChange={(e) => set("street", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>N° de maison</label>
              <input value={form.houseNumber} onChange={(e) => set("houseNumber", e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Point de repère</label>
              <input value={form.landmark} onChange={(e) => set("landmark", e.target.value)} className={inputCls} placeholder="Ex. en face de la pharmacie du coin" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Adresse complète (résumé)</label>
              <input value={form.addressFull} onChange={(e) => set("addressFull", e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Adresse courte (ancien champ, conservé)</label>
              <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
            </div>

            <Section title="Situation familiale" icon="👨‍👩‍👧" />
            <div>
              <label className={labelCls}>Situation matrimoniale</label>
              <select value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} className={inputCls}>
                <option value="">Sélectionner</option>
                <option value="celibataire">Célibataire</option>
                <option value="marie">Marié(e)</option>
                <option value="divorce">Divorcé(e)</option>
                <option value="veuf">Veuf / Veuve</option>
                <option value="union-libre">Union libre</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nombre d'enfants</label>
              <input type="number" min="0" value={form.childrenCount} onChange={(e) => set("childrenCount", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nom du conjoint</label>
              <input value={form.spouseName} onChange={(e) => set("spouseName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone du conjoint</label>
              <input value={form.spousePhone} onChange={(e) => set("spousePhone", e.target.value)} className={inputCls} />
            </div>

            <Section title="Contact d'urgence" icon="🚨" />
            <div>
              <label className={labelCls}>Nom et prénom (contact d'urgence)</label>
              <input value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Relation avec le patient</label>
              <input value={form.emergencyRelation} onChange={(e) => set("emergencyRelation", e.target.value)} className={inputCls} placeholder="Ex. frère, épouse, voisin" />
            </div>
            <div>
              <label className={labelCls}>Tél. urgence principal</label>
              <input value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} className={inputCls} />
              <input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} className={`${inputCls} mt-2`} placeholder="Nom (ancien champ, conservé)" />
            </div>
            <div>
              <label className={labelCls}>Tél. urgence secondaire</label>
              <input value={form.emergencyPhoneSecondary} onChange={(e) => set("emergencyPhoneSecondary", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp urgence</label>
              <input value={form.emergencyWhatsapp} onChange={(e) => set("emergencyWhatsapp", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ville (urgence)</label>
              <input value={form.emergencyCity} onChange={(e) => set("emergencyCity", e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Adresse (urgence)</label>
              <input value={form.emergencyAddress} onChange={(e) => set("emergencyAddress", e.target.value)} className={inputCls} />
            </div>

            <Section title="Profession" icon="💼" />
            <div>
              <label className={labelCls}>Profession</label>
              <input value={form.profession} onChange={(e) => set("profession", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Employeur</label>
              <input value={form.employer} onChange={(e) => set("employer", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone professionnel</label>
              <input value={form.workPhone} onChange={(e) => set("workPhone", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>E-mail professionnel</label>
              <input type="email" value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Adresse professionnelle</label>
              <input value={form.workAddress} onChange={(e) => set("workAddress", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ville (professionnelle)</label>
              <input value={form.workCity} onChange={(e) => set("workCity", e.target.value)} className={inputCls} />
            </div>

            <Section title="Assurance / ENAM" icon="🛡️" />
            <div>
              <label className={labelCls}>Organisme d'assurance</label>
              <select value={form.insurerName} onChange={(e) => set("insurerName", e.target.value)} className={inputCls}>
                <option value="">Sélectionner</option>
                <option>ENAM</option>
                <option>AMU (CNSS)</option>
                <option>NSIA</option>
                <option>SUNU</option>
                <option>GCNA</option>
                <option>Sanlam</option>
                <option>Autre</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>N° assuré</label>
              <input value={form.insuredNumber} onChange={(e) => set("insuredNumber", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>N° de carte</label>
              <input value={form.insuranceCardNumber} onChange={(e) => set("insuranceCardNumber", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type de couverture</label>
              <input value={form.coverageType} onChange={(e) => set("coverageType", e.target.value)} className={inputCls} placeholder="Ex. 80 % soins, 100 % maternité" />
            </div>
            <div>
              <label className={labelCls}>Début de couverture</label>
              <input type="date" value={form.coverageStart} onChange={(e) => set("coverageStart", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expiration de couverture</label>
              <input type="date" value={form.coverageEnd} onChange={(e) => set("coverageEnd", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Statut de couverture</label>
              <select value={form.coverageStatus} onChange={(e) => set("coverageStatus", e.target.value)} className={inputCls}>
                <option value="">Sélectionner</option>
                <option value="active">Active</option>
                <option value="expiree">Expirée</option>
                <option value="suspendue">Suspendue</option>
                <option value="inconnue">Inconnue</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>N° Assurance (ancien champ, conservé)</label>
              <input value={form.insuranceNumber} onChange={(e) => set("insuranceNumber", e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <span>📷</span>
                <span>Le <b>scanner de carte ENAM</b> (photo → remplissage automatique + vérification avant enregistrement) arrive dans la vague 2.4 de SantéOnline.</span>
              </div>
            </div>

            <Section title="Notes médicales" icon="📝" />
            <div className="sm:col-span-2">
              <textarea rows={3} value={form.medicalNotes} onChange={(e) => set("medicalNotes", e.target.value)} className={inputCls} placeholder="Allergies, antécédents importants…" />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editing ? "Enregistrer" : "Créer le patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
