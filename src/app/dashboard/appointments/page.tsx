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
  Calendar,
  Clock,
  Zap,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Appointment {
  id: number;
  patientId: number;
  facilityId: number;
  doctorId: number | null;
  title: string;
  type: string;
  status: string;
  scheduledDate: string;
  endDate: string;
  notes: string;
  isAutoScheduled: boolean;
  patientResponse?: string | null;
  createdAt: string;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  facilityName: string;
  facilityType: string;
}

interface Patient {
  id: number;
  fullName: string;
  email: string;
}

interface Facility {
  id: number;
  name: string;
  type: string;
}

interface Doctor {
  id: number;
  fullName: string;
  facilityId: number;
}

const statusLabels: { [key: string]: string } = {
  pending: "En attente",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const statusColors: { [key: string]: string } = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-100 text-gray-700",
};

const typeLabels: { [key: string]: string } = {
  consultation: "Consultation",
  lab_test: "Analyse Labo",
  follow_up: "Suivi",
  emergency: "Urgence",
  specialist: "Spécialiste",
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getWhatsAppReminderLink = (apt: Appointment) => {
    const rawPhone = apt.patientPhone || "";
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
    
    const d = new Date(apt.scheduledDate);
    const dateStr = format(d, "EEEE d MMMM yyyy", { locale: fr });
    const timeStr = format(d, "HH:mm");
    const facilityName = apt.facilityName || "votre Cabinet Médical";

    const message = `Bonjour ${apt.patientName || "Chère Patiente / Cher Patient"},\n\nNous vous rappelons chaleureusement votre prochain rendez-vous de santé :\n\n🏢 Établissement : *${facilityName}*\n📅 Date : *${dateStr}*\n⏰ Heure : *${timeStr}*\n🩺 Motif : *${apt.title}*\n\nPour le bon fonctionnement du cabinet, si vous avez un empêchement, merci de nous en informer le plus tôt possible.\n\nPrenez soin de vous,\nL'équipe de ${facilityName} 💚`;

    return `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(message)}`;
  };
  const [showForm, setShowForm] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [formData, setFormData] = useState({
    patientId: "",
    facilityId: "",
    doctorId: "",
    title: "",
    type: "consultation",
    status: "pending",
    scheduledDate: "",
    scheduledTime: "09:00",
    notes: "",
    isAutoScheduled: false,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [aptRes, patRes, facRes, docRes] = await Promise.all([
        fetch("/api/appointments"),
        fetch("/api/patients"),
        fetch("/api/facilities"),
        fetch("/api/doctors"),
      ]);
      const [aptData, patData, facData, docData] = await Promise.all([
        aptRes.json(),
        patRes.json(),
        facRes.json(),
        docRes.json(),
      ]);
      setAppointments(aptData);
      setPatients(patData);
      setFacilities(facData);
      setDoctors(docData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: "",
      facilityId: "",
      doctorId: "",
      title: "",
      type: "consultation",
      status: "pending",
      scheduledDate: format(new Date(), "yyyy-MM-dd"),
      scheduledTime: "09:00",
      notes: "",
      isAutoScheduled: false,
    });
    setEditingApt(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const scheduledDate = `${formData.scheduledDate}T${formData.scheduledTime}:00`;

      if (editingApt) {
        await fetch(`/api/appointments/${editingApt.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, scheduledDate }),
        });
      } else {
        await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, scheduledDate }),
        });
      }
      resetForm();
      fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (apt: Appointment) => {
    setEditingApt(apt);
    const d = new Date(apt.scheduledDate);
    setFormData({
      patientId: apt.patientId?.toString() || "",
      facilityId: apt.facilityId?.toString() || "",
      doctorId: apt.doctorId?.toString() || "",
      title: apt.title,
      type: apt.type,
      status: apt.status,
      scheduledDate: format(d, "yyyy-MM-dd"),
      scheduledTime: format(d, "HH:mm"),
      notes: apt.notes || "",
      isAutoScheduled: apt.isAutoScheduled,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    try {
      await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAutoSchedule = async () => {
    setAutoScheduling(true);
    try {
      await fetch("/api/appointments/auto-schedule", { method: "POST" });
      fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setAutoScheduling(false);
    }
  };

  const filtered = appointments.filter((apt) => {
    const matchSearch =
      apt.title?.toLowerCase().includes(search.toLowerCase()) ||
      apt.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      apt.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
      apt.facilityName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rendez-vous</h1>
          <p className="text-gray-500 mt-1">
            Gestion et planification des rendez-vous
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSchedule}
            disabled={autoScheduling}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
          >
            {autoScheduling ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Zap size={18} />
            )}
            Planification Auto
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <Plus size={18} />
            Nouveau
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          />
        </div>
        <div className="relative">
          <Filter
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white appearance-none"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingApt
                  ? "Modifier le Rendez-vous"
                  : "Nouveau Rendez-vous"}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient *
                  </label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) =>
                      setFormData({ ...formData, patientId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Sélectionner</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Établissement *
                  </label>
                  <select
                    required
                    value={formData.facilityId}
                    onChange={(e) =>
                      setFormData({ ...formData, facilityId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Sélectionner</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Médecin
                  </label>
                  <select
                    value={formData.doctorId}
                    onChange={(e) =>
                      setFormData({ ...formData, doctorId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Aucun</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titre *
                  </label>
                  <input
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scheduledDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heure
                  </label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scheduledTime: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingApt ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
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
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {search || statusFilter !== "all"
              ? "Aucun résultat"
              : "Aucun rendez-vous"}
          </h3>
          <p className="text-gray-500">
            {search
              ? "Essayez avec d'autres critères"
              : "Planifiez votre premier rendez-vous"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filtered.map((apt) => {
              const d = new Date(apt.scheduledDate);
              return (
                <div
                  key={apt.id}
                  className="p-4 sm:p-5 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        apt.isAutoScheduled
                          ? "bg-amber-50"
                          : "bg-violet-50"
                      }`}
                    >
                      {apt.isAutoScheduled ? (
                        <Zap size={18} className="text-amber-600" />
                      ) : (
                        <Calendar size={18} className="text-violet-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {apt.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-0.5">
                        <span className="truncate">
                          {apt.patientName || "Patient"}
                        </span>
                        <span>·</span>
                        <span className="truncate">
                          {apt.facilityName}
                        </span>
                        {apt.doctorName && (
                          <>
                            <span>·</span>
                            <span className="truncate">{apt.doctorName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 pl-14 sm:pl-0">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock size={14} />
                      <span>
                        {format(d, "dd MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                        statusColors[apt.status]
                      }`}
                    >
                      {statusLabels[apt.status]}
                    </span>
                    {apt.patientResponse === "confirmed" && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold whitespace-nowrap" title="Le patient a confirmé via son rappel automatique">
                        🙋 Présence confirmée
                      </span>
                    )}
                    {apt.patientResponse === "declined" && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold whitespace-nowrap" title="Le patient a signalé un empêchement">
                        ⚠️ Empêchement signalé
                      </span>
                    )}
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium whitespace-nowrap">
                      {typeLabels[apt.type]}
                    </span>
                    <div className="flex items-center gap-1">
                      <a
                        href={getWhatsAppReminderLink(apt)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-all flex items-center justify-center gap-1 text-xs font-semibold"
                        title="Envoyer rappel WhatsApp"
                      >
                        <svg className="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.03 11.966.03c3.184.001 6.177 1.242 8.424 3.493 2.248 2.25 3.483 5.247 3.48 8.432-.007 6.615-5.344 11.933-11.913 11.933-2.005-.002-3.973-.507-5.759-1.467L0 24zm6.59-4.846c1.66.986 3.288 1.493 4.908 1.495 5.485 0 9.948-4.42 9.953-9.855.003-2.633-1.018-5.111-2.877-6.974-1.858-1.863-4.329-2.888-6.963-2.89-5.49 0-9.953 4.421-9.958 9.858-.002 1.761.52 3.14 1.42 4.7l-.934 3.411 1.05-.445z"/>
                        </svg>
                        <span className="hidden sm:inline">Rappel WhatsApp</span>
                      </a>
                      <button
                        onClick={() => handleEdit(apt)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(apt.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
