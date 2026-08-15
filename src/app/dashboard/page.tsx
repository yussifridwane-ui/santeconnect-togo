"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Calendar,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  Phone,
  UserPlus,
  CalendarDays,
  Loader2,
  AlertCircle,
  Building2,
  Sparkles,
  Check,
} from "lucide-react";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import PatientPortalHome from "@/components/PatientPortalHome";

interface Patient {
  id: number;
  fullName: string;
  phone: string;
  medicalNotes: string;
  lastAppointmentStr?: string;
}

interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  patientPhone?: string;
  title: string;
  type: string;
  status: string;
  scheduledDate: string;
  notes: string;
}

export default function CabinetDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cabinetName, setCabinetName] = useState("Mon Cabinet Médical");

  const getWhatsAppReminderLink = (apt: Appointment) => {
    const rawPhone = apt.patientPhone || "";
    // Clean phone number from whitespace or non-digit characters
    const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
    
    const d = new Date(apt.scheduledDate);
    const dateStr = format(d, "EEEE d MMMM yyyy", { locale: fr });
    const timeStr = format(d, "HH:mm");

    const message = `Bonjour ${apt.patientName || "Chère Patiente / Cher Patient"},\n\nNous vous rappelons chaleureusement votre prochain rendez-vous de santé :\n\n🏢 Établissement : *${cabinetName}*\n📅 Date : *${dateStr}*\n⏰ Heure : *${timeStr}*\n🩺 Motif : *${apt.title}*\n\nPour le bon fonctionnement du cabinet, si vous avez un empêchement, merci de nous en informer le plus tôt possible.\n\nPrenez soin de vous,\nL'équipe de ${cabinetName} 💚`;

    return `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(message)}`;
  };

  // Form states
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showAptForm, setShowAptForm] = useState(false);

  // New patient state
  const [newPatientData, setNewPatientData] = useState({
    fullName: "",
    phone: "",
    notes: "",
  });

  // New appointment state
  const [newAptData, setNewAptData] = useState({
    patientId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    motif: "",
  });

  // Filter state
  const [patientSearch, setPatientSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetchCabinetData();
  }, []);

  const fetchCabinetData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Cabinet Info
      const facRes = await fetch("/api/facilities");
      const facs = await facRes.json();
      const currentCabinet = facs.find(
        (f: any) => f.id === (user?.facilityId || 1)
      );
      if (currentCabinet) {
        setCabinetName(currentCabinet.name);
      }

      // 2. Fetch Patients for this Cabinet
      const patRes = await fetch("/api/patients");
      const patientsData = await patRes.json();

      // 3. Fetch Appointments for this Cabinet
      const aptRes = await fetch("/api/appointments");
      const appointmentsData = await aptRes.json();

      // Correlate last appointments to patients
      const processedPatients = patientsData.map((pat: any) => {
        const patApts = appointmentsData.filter(
          (a: any) => a.patientId === pat.id
        );
        let lastAptDate = "Aucun";
        if (patApts.length > 0) {
          // Sort by scheduledDate descending
          const sorted = [...patApts].sort(
            (a, b) =>
              new Date(b.scheduledDate).getTime() -
              new Date(a.scheduledDate).getTime()
          );
          const d = new Date(sorted[0].scheduledDate);
          lastAptDate = format(d, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
        }
        return {
          id: pat.id,
          fullName: pat.fullName,
          phone: pat.phone || "Non renseigné",
          medicalNotes: pat.medicalNotes || "Aucune note",
          lastAppointmentStr: lastAptDate,
        };
      });

      setPatients(processedPatients);
      setAppointments(appointmentsData);
    } catch (e) {
      console.error("Error fetching cabinet workspace data:", e);
    } finally {
      setLoading(false);
    }
  };

  const triggerNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientData.fullName) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newPatientData.fullName,
          phone: newPatientData.phone,
          medicalNotes: newPatientData.notes,
        }),
      });

      if (res.ok) {
        triggerNotification("Patient ajouté avec succès !");
        setNewPatientData({ fullName: "", phone: "", notes: "" });
        setShowPatientForm(false);
        await fetchCabinetData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAptData.patientId || !newAptData.motif) return;
    setSubmitting(true);
    try {
      const scheduledDate = `${newAptData.date}T${newAptData.time}:00`;
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: newAptData.patientId,
          title: newAptData.motif,
          scheduledDate: scheduledDate,
          type: "consultation",
          status: "confirmed",
          notes: "Ajouté depuis le tableau de bord du cabinet",
        }),
      });

      if (res.ok) {
        triggerNotification("Rendez-vous programmé avec succès !");
        setNewAptData({
          patientId: "",
          date: format(new Date(), "yyyy-MM-dd"),
          time: "09:00",
          motif: "",
        });
        setShowAptForm(false);
        await fetchCabinetData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick category filters
  const todayAppointments = appointments.filter((apt) => {
    try {
      const date = new Date(apt.scheduledDate);
      return isToday(date);
    } catch {
      return false;
    }
  });

  const weekAppointments = appointments.filter((apt) => {
    try {
      const date = new Date(apt.scheduledDate);
      return isThisWeek(date, { weekStartsOn: 1 }); // Monday start
    } catch {
      return false;
    }
  });

  const filteredPatients = patients.filter((pat) =>
    pat.fullName.toLowerCase().includes(patientSearch.toLowerCase())
  );

  // V2.2 — ESPACE PATIENT : RDV lisibles + dossier verrouillé par son code (style T-Money)
  if (user?.role === "patient") {
    return <PatientPortalHome userName={user.fullName} />;
  }

  return (
    <div className="space-y-6">
      {/* Alert banner for successes */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <Check size={18} />
          <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-800 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-12 translate-x-12 pointer-events-none">
          <Building2 size={320} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wider text-emerald-200 w-max uppercase mb-3">
              <Sparkles size={12} />
              Cabinet Connecté
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {cabinetName}
            </h1>
            <p className="text-emerald-100/90 mt-2 text-sm max-w-xl">
              Bienvenue sur votre espace de travail. Toutes les données ci-dessous sont cryptées et isolées exclusivement pour votre cabinet médical.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setShowPatientForm(true);
                setShowAptForm(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-800 font-semibold rounded-xl hover:bg-emerald-50 transition-colors shadow-md text-sm"
            >
              <UserPlus size={16} />
              Nouveau Patient
            </button>
            <button
              onClick={() => {
                setShowAptForm(true);
                setShowPatientForm(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition-colors shadow-md text-sm border border-emerald-500"
            >
              <CalendarDays size={16} />
              Nouveau Rendez-vous
            </button>
          </div>
        </div>
      </div>

      {/* Quiz d'entraînement — discret, soignants uniquement (V2.2) */}
      <a
        href="/dashboard/examens"
        className="w-full flex items-center gap-3 bg-white border border-emerald-100 rounded-2xl px-5 py-3.5 hover:border-emerald-300 hover:shadow-md transition-all"
      >
        <span className="text-2xl">🧠</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-gray-900">Quiz d'entraînement clinique</span>
          <span className="block text-xs text-gray-500">Soignants — 10 questions rapides sur les examens paracliniques, entre deux dossiers.</span>
        </span>
        <span className="text-emerald-600 font-bold text-sm shrink-0">Jouer →</span>
      </a>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Patients inscrits</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{patients.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Rendez-vous aujourd'hui</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{todayAppointments.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Rendez-vous cette semaine</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{weekAppointments.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Calendar size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between col-span-1">
          <div>
            <p className="text-sm font-medium text-gray-500">Statut du Cabinet</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mt-2">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
              Ouvert / Actif
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {/* Add Patient Modal */}
      {showPatientForm && (
        <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 text-emerald-800">
              <UserPlus size={20} />
              Ajouter un Nouveau Patient au Cabinet
            </h3>
            <button
              onClick={() => setShowPatientForm(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Fermer
            </button>
          </div>
          <form onSubmit={handleAddPatient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Nom Complet *
              </label>
              <input
                required
                placeholder="Ex. Yao Amégandji"
                value={newPatientData.fullName}
                onChange={(e) =>
                  setNewPatientData({ ...newPatientData, fullName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Numéro de téléphone
              </label>
              <input
                placeholder="Ex. +228 90 00 11 22"
                value={newPatientData.phone}
                onChange={(e) =>
                  setNewPatientData({ ...newPatientData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Notes médicales / Symptômes
              </label>
              <textarea
                rows={2}
                placeholder="Ex. Hypertension, Antécédents familiaux de diabète..."
                value={newPatientData.notes}
                onChange={(e) =>
                  setNewPatientData({ ...newPatientData, notes: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPatientForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Enregistrer le Patient
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Appointment Modal */}
      {showAptForm && (
        <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 text-emerald-800">
              <CalendarDays size={20} />
              Planifier un Rendez-vous pour un Patient
            </h3>
            <button
              onClick={() => setShowAptForm(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Fermer
            </button>
          </div>
          {patients.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              Veuillez d'abord ajouter un patient pour planifier un rendez-vous.
            </div>
          ) : (
            <form onSubmit={handleAddAppointment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Sélectionner un Patient *
                </label>
                <select
                  required
                  value={newAptData.patientId}
                  onChange={(e) =>
                    setNewAptData({ ...newAptData, patientId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Choisir un patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Date du rendez-vous *
                </label>
                <input
                  type="date"
                  required
                  value={newAptData.date}
                  onChange={(e) =>
                    setNewAptData({ ...newAptData, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Heure *
                </label>
                <input
                  type="time"
                  required
                  value={newAptData.time}
                  onChange={(e) =>
                    setNewAptData({ ...newAptData, time: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Motif de consultation *
                </label>
                <input
                  required
                  placeholder="Ex. Consultation générale, Fièvre..."
                  value={newAptData.motif}
                  onChange={(e) =>
                    setNewAptData({ ...newAptData, motif: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAptForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Valider le Rendez-vous
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Agenda des Rendez-vous (Today and This Week) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-emerald-50/50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Clock className="text-emerald-700" size={18} />
                Aujourd'hui
              </h2>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {todayAppointments.length} rdv
              </span>
            </div>
            <div className="p-4 divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : todayAppointments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Aucun rendez-vous planifié aujourd'hui
                </p>
              ) : (
                todayAppointments.map((apt) => (
                  <div key={apt.id} className="py-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-950 truncate">
                        {apt.patientName || "Patient du cabinet"}
                      </p>
                      <p className="text-xs text-gray-500 font-medium truncate">{apt.title}</p>
                      {apt.patientPhone && (
                        <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> {apt.patientPhone}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-lg">
                        {format(new Date(apt.scheduledDate), "HH:mm")}
                      </span>
                      <a
                        href={getWhatsAppReminderLink(apt)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-all flex items-center justify-center gap-1 text-[11px] font-bold"
                        title="Envoyer rappel WhatsApp"
                      >
                        <svg className="w-4 h-4 fill-emerald-700" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.03 11.966.03c3.184.001 6.177 1.242 8.424 3.493 2.248 2.25 3.483 5.247 3.48 8.432-.007 6.615-5.344 11.933-11.913 11.933-2.005-.002-3.973-.507-5.759-1.467L0 24zm6.59-4.846c1.66.986 3.288 1.493 4.908 1.495 5.485 0 9.948-4.42 9.953-9.855.003-2.633-1.018-5.111-2.877-6.974-1.858-1.863-4.329-2.888-6.963-2.89-5.49 0-9.953 4.421-9.958 9.858-.002 1.761.52 3.14 1.42 4.7l-.934 3.411 1.05-.445z"/>
                        </svg>
                        <span>Rappel</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-emerald-50/50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="text-teal-700" size={18} />
                Cette Semaine
              </h2>
              <span className="text-xs font-semibold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                {weekAppointments.length} rdv
              </span>
            </div>
            <div className="p-4 divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : weekAppointments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Aucun rendez-vous planifié cette semaine
                </p>
              ) : (
                weekAppointments.map((apt) => (
                  <div key={apt.id} className="py-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-950 truncate">
                        {apt.patientName || "Patient du cabinet"}
                      </p>
                      <p className="text-xs text-gray-500 font-medium truncate">{apt.title}</p>
                      {apt.patientPhone && (
                        <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> {apt.patientPhone}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs bg-gray-50 text-gray-600 font-medium px-2 py-1 rounded-lg text-right min-w-[65px]">
                        {format(new Date(apt.scheduledDate), "eee d HH:mm", { locale: fr })}
                      </span>
                      <a
                        href={getWhatsAppReminderLink(apt)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-all flex items-center justify-center gap-1 text-[11px] font-bold"
                        title="Envoyer rappel WhatsApp"
                      >
                        <svg className="w-4 h-4 fill-emerald-700" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.03 11.966.03c3.184.001 6.177 1.242 8.424 3.493 2.248 2.25 3.483 5.247 3.48 8.432-.007 6.615-5.344 11.933-11.913 11.933-2.005-.002-3.973-.507-5.759-1.467L0 24zm6.59-4.846c1.66.986 3.288 1.493 4.908 1.495 5.485 0 9.948-4.42 9.953-9.855.003-2.633-1.018-5.111-2.877-6.974-1.858-1.863-4.329-2.888-6.963-2.89-5.49 0-9.953 4.421-9.958 9.858-.002 1.761.52 3.14 1.42 4.7l-.934 3.411 1.05-.445z"/>
                        </svg>
                        <span>Rappel</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Patients du Cabinet with Last Appointment Details */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <h2 className="font-bold text-gray-950 flex items-center gap-2 text-lg">
                <Users className="text-emerald-700" size={20} />
                Mes Patients
              </h2>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Chercher par nom..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="p-2 divide-y divide-gray-100 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <Users size={36} className="mx-auto mb-2 text-gray-200" />
                  Aucun patient inscrit dans votre cabinet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50/20">
                      <th className="p-3">Patient</th>
                      <th className="p-3">Téléphone</th>
                      <th className="p-3">Dernier rdv</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPatients.map((pat) => (
                      <tr key={pat.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                              {pat.fullName.charAt(0)}
                            </div>
                            <span className="font-semibold text-gray-900">{pat.fullName}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Phone size={12} className="text-gray-400" />
                            {pat.phone}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded-lg font-medium">
                            {pat.lastAppointmentStr}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-500 max-w-[150px] truncate" title={pat.medicalNotes}>
                          {pat.medicalNotes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
