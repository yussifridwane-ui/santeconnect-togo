"use client";

import { useState } from "react";
import { FileText, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function RecordsPage() {
  const [search, setSearch] = useState("");
  const [loading] = useState(false);

  const records = [
    {
      id: 1,
      title: "Consultation - Hypertension",
      diagnosis: "Hypertension artérielle légère (145/95)",
      prescription: "Amlodipine 5mg - 1 comprimé par jour",
      patientName: "Komlan Akakpo",
      doctorName: "Dr. Ama Agbemadon",
      facilityName: "Clinique de la Paix",
      recordType: "consultation",
      createdAt: "2024-01-15T10:00:00",
    },
    {
      id: 2,
      title: "Bilan diabétique trimestriel",
      diagnosis: "Diabète type 2 équilibré (HbA1c: 7.2%)",
      prescription: "Metformine 1000mg - 2 comprimés par jour",
      patientName: "Edem Foli",
      doctorName: "Dr. Ama Agbemadon",
      facilityName: "Clinique de la Paix",
      recordType: "bilan",
      createdAt: "2024-01-10T14:00:00",
    },
    {
      id: 3,
      title: "Consultation cardiologique",
      diagnosis: "Insuffisance cardiaque légère, arythmie",
      prescription: "Bisoprolol 2.5mg matin, Furosémide 40mg matin",
      patientName: "Ayité Gbeku",
      doctorName: "Dr. Kodjo Abla",
      facilityName: "Hôpital Sylvanus Olympio",
      recordType: "consultation_specialiste",
      createdAt: "2024-01-08T11:00:00",
    },
  ];

  const filtered = records.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.patientName.toLowerCase().includes(search.toLowerCase()) ||
      r.diagnosis.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dossiers Médicaux</h1>
        <p className="text-gray-500 mt-1">Historique médical des patients</p>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Rechercher un dossier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun dossier trouvé
          </h3>
          <p className="text-gray-500">
            {search
              ? "Essayez avec d'autres critères"
              : "Les dossiers médicaux apparaîtront ici"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {record.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                    <span>{record.patientName}</span>
                    <span>·</span>
                    <span>{record.doctorName}</span>
                    <span>·</span>
                    <span>{record.facilityName}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(record.createdAt), "dd MMM yyyy", {
                    locale: fr,
                  })}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Diagnostic</p>
                  <p className="text-gray-900">{record.diagnosis}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Prescription</p>
                  <p className="text-gray-900">{record.prescription}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
