"use client";

/* ════════════════════════════════════════════════════════════════════
   🛡️ V2.9 — Assurances du patient (MULTI-ASSUREURS)
   Bloc complet sur la fiche patient : liste des couvertures (cartes
   colorées par statut), ajout/modification/suppression, photo de carte
   (prise directement depuis le téléphone), choix de la primaire.
   ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Star,
  Trash2,
  Image as ImageIcon,
  BadgeCheck,
  Loader2,
  X,
  Camera,
} from "lucide-react";

export interface PatientInsurance {
  id: number;
  insurer_id: number | null;
  insurer_name: string | null;
  insurer_name_other: string | null;
  insurer_rate: number | null;
  insurance_number: string;
  status: string;
  is_primary: boolean;
  card_document_id: number | null;
  card_serial: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

interface InsurerLite {
  id: number;
  name: string;
  rate: number;
}

export const INS_STATUS: Record<string, { label: string; dot: string; chip: string }> = {
  actif: { label: "Actif", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expire: { label: "Expiré", dot: "bg-red-500", chip: "bg-red-50 text-red-700 border-red-200" },
  suspendu: { label: "Suspendu", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  inconnu: { label: "Inconnu", dot: "bg-gray-400", chip: "bg-gray-50 text-gray-600 border-gray-200" },
};

export const insLabel = (i: PatientInsurance) =>
  i.insurer_name || i.insurer_name_other || "Assurance";

const MAX_PHOTO_BYTES = 1_700_000;

function StatusChip({ status }: { status: string }) {
  const s = INS_STATUS[status] || INS_STATUS.inconnu;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function PatientInsurancesBlock({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<PatientInsurance[]>([]);
  const [insurers, setInsurers] = useState<InsurerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PatientInsurance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* Formulaire (ordre EXACT du cahier des charges) */
  const [insurerChoice, setInsurerChoice] = useState(""); // id numérique ou "autre"
  const [otherName, setOtherName] = useState("");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState("inconnu");
  const [photo, setPhoto] = useState<{ dataUrl: string; mime: string } | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/insurances`);
      if (res.ok) setRows(await res.json());
    } catch {
      /* silencieux : la fiche patient reste utilisable */
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    setLoading(true);
    fetchRows();
    fetch("/api/insurers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: InsurerLite[] | { insurers?: InsurerLite[] }) => {
        const arr = Array.isArray(d) ? d : d.insurers || [];
        /* Tri préférence cahier des charges : INAM d'abord, CNSS ensuite */
        const rank = (n: string) => (/inam/i.test(n) ? 0 : /cnss/i.test(n) ? 1 : 2);
        setInsurers([...arr].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, [fetchRows]);

  const resetForm = () => {
    setEditing(null);
    setInsurerChoice("");
    setOtherName("");
    setNumber("");
    setStatus("inconnu");
    setPhoto(null);
    setIsPrimary(false);
    setNotes("");
    setError("");
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (r: PatientInsurance) => {
    resetForm();
    setEditing(r);
    setInsurerChoice(r.insurer_id ? String(r.insurer_id) : "autre");
    setOtherName(r.insurer_name_other || "");
    setNumber(r.insurance_number);
    setStatus(r.status);
    setIsPrimary(r.is_primary);
    setNotes(r.notes || "");
    setShowForm(true);
  };

  /* Photo de carte : depuis la galerie OU l'appareil photo du téléphone
     (le sélecteur natif mobile propose « Prendre une photo »). */
  const onPickPhoto = (f: File | null) => {
    if (!f) return;
    setError("");
    const mime = f.type.toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      setError("Format refusé : uniquement JPG, PNG ou WEBP (une vraie photo de carte).");
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      setError("Photo trop lourde (max ~1,7 Mo) — rapproche-toi moins ou compresse-la.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto({ dataUrl: String(reader.result), mime });
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (saving) return;
    setError("");
    /* Validation cahier des charges : assureur + numéro obligatoires */
    if (!insurerChoice) return setError("Choisis l'assureur (INAM, CNSS… ou Autre).");
    if (insurerChoice === "autre" && !otherName.trim())
      return setError("Saisis le nom de la mutuelle.");
    if (!number.trim()) return setError("Le numéro d'assuré est obligatoire.");

    setSaving(true);
    try {
      let cardDocumentId: number | null = editing?.card_document_id || null;

      /* 1) Photo fournie → dépôt sécurisé via le module Documents (V2.8 :
            PDF/JPG/PNG/WEBP uniquement, copie en base, traçabilité audit) */
      if (photo) {
        const label =
          insurerChoice === "autre"
            ? otherName.trim()
            : insurers.find((i) => String(i.id) === insurerChoice)?.name || "Assurance";
        const up = await fetch(`/api/patients/${patientId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Carte assurance — ${label}`.slice(0, 250),
            kind: "carte_assurance",
            mime: photo.mime,
            data: photo.dataUrl,
          }),
        });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData.error || "Échec de l'envoi de la photo");
        cardDocumentId = upData.documentId;
        /* En modification, l'ancienne photo est remplacée (la nouvelle gagne) */
      }

      /* 2) Création ou mise à jour de la ligne d'assurance */
      const payload = {
        insurerId: insurerChoice === "autre" ? null : parseInt(insurerChoice),
        insurerNameOther: insurerChoice === "autre" ? otherName.trim() : null,
        insuranceNumber: number.trim(),
        status,
        isPrimary,
        notes: notes.trim() || null,
        cardDocumentId,
      };
      const res = await fetch(
        editing
          ? `/api/patients/${patientId}/insurances/${editing.id}`
          : `/api/patients/${patientId}/insurances`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");

      setShowForm(false);
      resetForm();
      await fetchRows();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setPrimary = async (r: PatientInsurance) => {
    if (r.is_primary) return;
    const res = await fetch(`/api/patients/${patientId}/insurances/${r.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insurerId: r.insurer_id,
        insurerNameOther: r.insurer_name_other,
        insuranceNumber: r.insurance_number,
        status: r.status,
        notes: r.notes,
        isPrimary: true,
      }),
    });
    if (res.ok) await fetchRows();
  };

  const markVerified = async (r: PatientInsurance) => {
    const res = await fetch(`/api/patients/${patientId}/insurances/${r.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verify: true }),
    });
    if (res.ok) await fetchRows();
  };

  const remove = async (r: PatientInsurance) => {
    if (
      !confirm(
        `Supprimer l'assurance « ${insLabel(r)} » de ce patient ?\n\nLa photo de carte liée sera supprimée avec. Cette action est tracée au journal de sécurité.`,
      )
    )
      return;
    const res = await fetch(`/api/patients/${patientId}/insurances/${r.id}`, { method: "DELETE" });
    if (res.ok) await fetchRows();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5" id="assurances">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-lg">🛡️</span>
        <h2 className="font-bold text-emerald-800 uppercase tracking-wide text-sm">
          Assurances maladie
        </h2>
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
          {rows.length === 0 ? "Non assuré" : `${rows.length} couverture${rows.length > 1 ? "s" : ""}`}
        </span>
        <div className="flex-1" />
        <button
          onClick={showForm ? () => { setShowForm(false); resetForm(); } : openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Annuler" : "+ Ajouter une assurance"}
        </button>
      </div>

      {/* ══════ FORMULAIRE (ordre exact du cahier des charges) ══════ */}
      {showForm && (
        <div className="mb-5 border-2 border-indigo-100 rounded-2xl p-4 space-y-3 bg-indigo-50/40">
          <p className="font-bold text-gray-900 text-sm">
            {editing ? `✏️ Modifier — ${insLabel(editing)}` : "🛡️ Nouvelle assurance du patient"}
          </p>

          {/* 1. Assureur */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Assureur *</label>
            <select
              value={insurerChoice}
              onChange={(e) => setInsurerChoice(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">— Choisir l'assureur —</option>
              {insurers.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.name} ({i.rate} %)
                </option>
              ))}
              <option value="autre">Autre (saisir le nom de la mutuelle)</option>
            </select>
          </div>

          {/* 2. Nom de la mutuelle si Autre */}
          {insurerChoice === "autre" && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Nom de la mutuelle *</label>
              <input
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="Ex. Mutuelle des enseignants"
                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}

          {/* 3. Numéro d'assuré */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Numéro d'assuré *</label>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex. INAM-2026-XXXXXX"
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* 4. Statut */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Statut (saisi par le personnel)</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="inconnu">Inconnu</option>
              <option value="actif">Actif</option>
              <option value="expire">Expiré</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>

          {/* 5. Photo de la carte (caméra téléphone OK) */}
          <div>
            <label className="text-xs font-semibold text-gray-600">
              Photo de la carte (optionnel — 📱 le téléphone propose « Prendre une photo »)
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-indigo-300 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50"
              >
                <Camera size={16} /> {photo ? "Changer la photo" : "Photographier la carte"}
              </button>
              {photo && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <ImageIcon size={14} /> Photo prête ✓
                  <button onClick={() => setPhoto(null)} className="text-red-400 hover:text-red-600 ml-1">
                    <X size={14} />
                  </button>
                </span>
              )}
              {!photo && editing?.card_document_id && (
                <span className="text-xs text-gray-500">Carte actuelle conservée ✓</span>
              )}
            </div>
          </div>

          {/* 6. Primaire */}
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 pt-1">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            ⭐ Définir comme assurance primaire (utilisée par défaut en prescription)
          </label>

          {/* 7. Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex. : carte expirée le 12/2026, à renouveler"
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {editing ? "Enregistrer les modifications" : "Enregistrer l'assurance"}
          </button>
        </div>
      )}

      {/* ══════ LISTE ══════ */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
          <ShieldCheck size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-gray-500">Non assuré</p>
          <p className="text-xs text-gray-400 mt-1">
            Ajoute la couverture du patient (INAM, CNSS, mutuelle…) — affichée ensuite lors des prescriptions.
          </p>
          <button
            onClick={openAdd}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
          >
            <Plus size={15} /> Ajouter une assurance
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`border rounded-xl p-4 ${r.is_primary ? "border-indigo-300 bg-indigo-50/50" : "border-gray-100"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck size={18} className={r.is_primary ? "text-indigo-600" : "text-gray-400"} />
                <p className="font-bold text-gray-900 text-sm">{insLabel(r)}</p>
                {r.is_primary && (
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full uppercase">
                    ⭐ Primaire
                  </span>
                )}
                <StatusChip status={r.status} />
                <div className="flex-1" />
                <span className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                  {r.insurance_number}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {r.insurer_rate != null && r.insurer_id != null && (
                  <span>Prise en charge indicative : {r.insurer_rate} %</span>
                )}
                {r.verified_at ? (
                  <span className="text-emerald-700 font-semibold">
                    ✔️ Vérifiée le {new Date(r.verified_at).toLocaleDateString("fr-FR")}
                  </span>
                ) : (
                  <span className="text-gray-400">Non vérifiée par le personnel</span>
                )}
                {r.notes && <span className="italic">📝 {r.notes}</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => openEdit(r)}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  <Pencil size={13} /> Modifier
                </button>
                {!r.is_primary && (
                  <button
                    onClick={() => setPrimary(r)}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-50"
                  >
                    <Star size={13} /> Définir comme primaire
                  </button>
                )}
                {!r.verified_at && (
                  <button
                    onClick={() => markVerified(r)}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-50"
                  >
                    <BadgeCheck size={13} /> Marquer vérifiée
                  </button>
                )}
                {r.card_document_id && (
                  <a
                    href={`/api/documents/${r.card_document_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
                  >
                    <ImageIcon size={13} /> Voir la carte
                  </a>
                )}
                <button
                  onClick={() => remove(r)}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 ml-auto"
                >
                  <Trash2 size={13} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
