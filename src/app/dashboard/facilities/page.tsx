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
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Clock,
} from "lucide-react";

interface Facility {
  id: number;
  name: string;
  type: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  capacity: number | null;
  operatingHours: string;
  isActive: boolean;
  createdAt: string;
}

const typeLabels: { [key: string]: string } = {
  clinic: "Clinique",
  laboratory: "Laboratoire",
  hospital: "Hôpital",
};

const typeColors: { [key: string]: string } = {
  clinic: "bg-emerald-100 text-emerald-700",
  laboratory: "bg-blue-100 text-blue-700",
  hospital: "bg-violet-100 text-violet-700",
};

const typeIcons: { [key: string]: any } = {
  clinic: Building2,
  laboratory: Building2,
  hospital: Building2,
};

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "clinic",
    description: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    capacity: "",
    operatingHours: "",
  });

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const res = await fetch("/api/facilities");
      const data = await res.json();
      setFacilities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "clinic",
      description: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      capacity: "",
      operatingHours: "",
    });
    setEditingFacility(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingFacility) {
        await fetch(`/api/facilities/${editingFacility.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/facilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
      resetForm();
      fetchFacilities();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setFormData({
      name: facility.name,
      type: facility.type,
      description: facility.description || "",
      address: facility.address,
      city: facility.city,
      phone: facility.phone,
      email: facility.email || "",
      capacity: facility.capacity?.toString() || "",
      operatingHours: facility.operatingHours || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet établissement ?")) return;
    try {
      await fetch(`/api/facilities/${id}`, { method: "DELETE" });
      setFacilities((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = facilities.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase()) ||
      f.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Établissements</h1>
          <p className="text-gray-500 mt-1">
            Cliniques, laboratoires et hôpitaux du Togo
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
          Nouvel Établissement
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
          placeholder="Rechercher un établissement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
        />
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingFacility
                  ? "Modifier l'Établissement"
                  : "Nouvel Établissement"}
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
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    required
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
                    Ville *
                  </label>
                  <input
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse *
                  </label>
                  <input
                    required
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone *
                  </label>
                  <input
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
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
                    Capacité (lits/places)
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heures d'ouverture
                  </label>
                  <input
                    value={formData.operatingHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        operatingHours: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
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
                  {editingFacility ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun établissement
          </h3>
          <p className="text-gray-500">
            {search
              ? "Essayez avec d'autres critères"
              : "Ajoutez votre premier établissement"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((facility) => {
            const Icon = typeIcons[facility.type] || Building2;
            return (
              <div
                key={facility.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Icon size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {facility.name}
                        </h3>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                            typeColors[facility.type]
                          }`}
                        >
                          {typeLabels[facility.type]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(facility)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(facility.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {facility.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {facility.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">
                        {facility.address}, {facility.city}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-gray-400 flex-shrink-0" />
                      <span>{facility.phone}</span>
                    </div>
                    {facility.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{facility.email}</span>
                      </div>
                    )}
                    {facility.capacity && (
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-gray-400 flex-shrink-0" />
                        <span>Capacité: {facility.capacity} lits</span>
                      </div>
                    )}
                    {facility.operatingHours && (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-400 flex-shrink-0" />
                        <span>{facility.operatingHours}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
