"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
  Users,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Patient {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  insuranceNumber: string;
  medicalNotes: string;
  createdAt: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodType: "",
    address: "",
    emergencyContact: "",
    emergencyPhone: "",
    insuranceNumber: "",
    medicalNotes: "",
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/patients");
      const data = await res.json();
      setPatients(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      bloodType: "",
      address: "",
      emergencyContact: "",
      emergencyPhone: "",
      insuranceNumber: "",
      medicalNotes: "",
    });
    setEditingPatient(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingPatient) {
        await fetch(`/api/patients/${editingPatient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
      resetForm();
      fetchPatients();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      fullName: patient.fullName,
      email: patient.email,
      phone: patient.phone || "",
      dateOfBirth: patient.dateOfBirth
        ? format(new Date(patient.dateOfBirth), "yyyy-MM-dd")
        : "",
      gender: patient.gender || "",
      bloodType: patient.bloodType || "",
      address: patient.address || "",
      emergencyContact: patient.emergencyContact || "",
      emergencyPhone: patient.emergencyPhone || "",
      insuranceNumber: patient.insuranceNumber || "",
      medicalNotes: patient.medicalNotes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) return;
    try {
      await fetch(`/api/patients/${id}`, { method: "DELETE" });
      setPatients((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = patients.filter(
    (p) =>
      p.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">
            Gestion des patients enregistrés
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          <Plus size={18} />
          Nouveau Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Rechercher un patient par nom, email ou téléphone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
        />
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPatient ? "Modifier le Patient" : "Nouveau Patient"}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet *
                  </label>
                  <input
                    required
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Genre
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Sélectionner</option>
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Groupe sanguin
                  </label>
                  <select
                    value={formData.bloodType}
                    onChange={(e) =>
                      setFormData({ ...formData, bloodType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Sélectionner</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse
                  </label>
                  <input
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact d'urgence
                  </label>
                  <input
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tél. urgence
                  </label>
                  <input
                    value={formData.emergencyPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyPhone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    N° Assurance
                  </label>
                  <input
                    value={formData.insuranceNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        insuranceNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes médicales
                  </label>
                  <textarea
                    rows={3}
                    value={formData.medicalNotes}
                    onChange={(e) =>
                      setFormData({ ...formData, medicalNotes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingPatient ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Patient Modal */}
      {viewingPatient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Fiche Patient
              </h2>
              <button
                onClick={() => setViewingPatient(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-xl font-bold text-emerald-600">
                  {viewingPatient.fullName?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {viewingPatient.fullName}
                  </h3>
                  <p className="text-sm text-gray-500">{viewingPatient.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Téléphone</p>
                  <p className="font-medium">{viewingPatient.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date de naissance</p>
                  <p className="font-medium">
                    {viewingPatient.dateOfBirth
                      ? format(new Date(viewingPatient.dateOfBirth), "dd MMM yyyy", {
                          locale: fr,
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Genre</p>
                  <p className="font-medium capitalize">
                    {viewingPatient.gender || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Groupe sanguin</p>
                  <p className="font-medium">
                    {viewingPatient.bloodType || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Adresse</p>
                  <p className="font-medium">{viewingPatient.address || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Contact d'urgence</p>
                  <p className="font-medium">
                    {viewingPatient.emergencyContact || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Tél. urgence</p>
                  <p className="font-medium">
                    {viewingPatient.emergencyPhone || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">N° Assurance</p>
                  <p className="font-medium">
                    {viewingPatient.insuranceNumber || "—"}
                  </p>
                </div>
                {viewingPatient.medicalNotes && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Notes médicales</p>
                    <p className="font-medium text-red-600 bg-red-50 p-3 rounded-lg mt-1">
                      {viewingPatient.medicalNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {search ? "Aucun résultat" : "Aucun patient enregistré"}
          </h3>
          <p className="text-gray-500">
            {search
              ? "Essayez avec d'autres critères de recherche"
              : "Commencez par ajouter votre premier patient"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Téléphone
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Groupe Sanguin
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Assurance
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-600 flex-shrink-0">
                          {patient.fullName?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {patient.fullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {patient.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                      {patient.phone || "—"}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {patient.bloodType ? (
                        <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-medium">
                          {patient.bloodType}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {patient.insuranceNumber || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingPatient(patient)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(patient)}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(patient.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
