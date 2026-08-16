"use client";

/* ════════════════════════════════════════════════════════════════════
   🛡️ V2.9 — BANDEAU ASSURANCE SUR L'ÉCRAN DE PRESCRIPTION
   En haut de l'onglet Ordonnances : l'assurance PRIMAIRE du patient
   (nom + numéro + statut coloré). Si plusieurs couvertures, le médecin
   peut choisir laquelle utiliser pour CETTE ordonnance (cas rare).
   Aucune couverture → bandeau « paiement direct », sans bloquer.
   ════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

export interface RxInsChoice {
  id: number;
  label: string;
  number: string;
  status: string;
  primary: boolean;
}

interface Row {
  id: number;
  insurer_name: string | null;
  insurer_name_other: string | null;
  insurance_number: string;
  status: string;
  is_primary: boolean;
}

const STATUS_STYLE: Record<string, { label: string; chip: string }> = {
  actif: { label: "Actif", chip: "bg-emerald-100 text-emerald-800" },
  expire: { label: "Expiré", chip: "bg-red-100 text-red-700" },
  suspendu: { label: "Suspendu", chip: "bg-amber-100 text-amber-800" },
  inconnu: { label: "Inconnu", chip: "bg-gray-100 text-gray-600" },
};

const toChoice = (r: Row): RxInsChoice => ({
  id: r.id,
  label: r.insurer_name || r.insurer_name_other || "Assurance",
  number: r.insurance_number,
  status: r.status,
  primary: r.is_primary,
});

function Chip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.inconnu;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${s.chip}`}>{s.label}</span>
  );
}

export default function RxInsuranceBanner({
  patientId,
  onSelect,
}: {
  patientId: number;
  onSelect: (choice: RxInsChoice | null) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSelectedId(null);
    onSelect(null);
    fetch(`/api/patients/${patientId}/insurances`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Row[]) => {
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        setRows(rows);
        /* La PRIMAIRE est utilisée par défaut (règle du cahier des charges) */
        const primary = rows.find((r) => r.is_primary) || null;
        setSelectedId(primary ? primary.id : null);
        onSelect(primary ? toChoice(primary) : null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  if (!loaded) return null;

  /* ── Aucune assurance enregistrée : bandeau informatif, NON bloquant ── */
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
        <ShieldCheck size={17} className="text-amber-500 flex-shrink-0" />
        <p className="text-amber-800 font-medium">
          Patient non assuré — paiement direct
        </p>
      </div>
    );
  }

  const selected = rows.find((r) => r.id === selectedId) || null;

  const pick = (r: Row) => {
    setSelectedId(r.id);
    onSelect(toChoice(r));
    setOpen(false);
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ShieldCheck size={17} className="text-indigo-600 flex-shrink-0" />
        <p className="text-indigo-900">
          Assurance utilisée : <b>{selected ? selected.insurer_name || selected.insurer_name_other || "Assurance" : "—"}</b>
          {selected && (
            <>
              {" "}
              <span className="font-mono text-xs bg-white/70 px-1.5 py-0.5 rounded border border-indigo-100">
                N° {selected.insurance_number}
              </span>
            </>
          )}
        </p>
        {selected && <Chip status={selected.status} />}
        {selected?.is_primary && (
          <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full uppercase">
            ⭐ Primaire
          </span>
        )}
        <div className="flex-1" />
        {rows.length > 1 && (
          <button
            onClick={() => setOpen((s) => !s)}
            className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
          >
            Voir toutes les assurances ({rows.length})
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Sélecteur : pour CETTE prescription uniquement */}
      {open && (
        <div className="mt-3 space-y-1.5 border-t border-indigo-100 pt-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              className={`w-full flex flex-wrap items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm ${
                r.id === selectedId
                  ? "border-indigo-400 bg-white shadow-sm"
                  : "border-transparent bg-white/50 hover:bg-white"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                  r.id === selectedId ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
                }`}
              />
              <span className="font-semibold text-gray-900">
                {r.insurer_name || r.insurer_name_other || "Assurance"}
              </span>
              <span className="font-mono text-xs text-gray-500">N° {r.insurance_number}</span>
              <Chip status={r.status} />
              {r.is_primary && (
                <span className="text-[10px] font-bold text-indigo-600 uppercase">⭐ Primaire</span>
              )}
            </button>
          ))}
          <p className="text-[11px] text-indigo-500 pt-1">
            Le choix s'applique uniquement à l'ordonnance en cours — la primaire reste celle par défaut.
          </p>
        </div>
      )}
    </div>
  );
}
