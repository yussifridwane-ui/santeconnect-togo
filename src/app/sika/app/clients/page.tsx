"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, MessageCircle } from "lucide-react";

export default function SikaCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/sika/customers").then((r) => r.json()).then((d) => setCustomers(Array.isArray(d) ? d : []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/sika/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ name: "", phone: "" });
    setBusy(false);
    load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex flex-wrap gap-2">
        <input required placeholder="Nom du client *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-lg flex-1 min-w-[140px]" />
        <input required placeholder="Téléphone WhatsApp *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border rounded-lg flex-1 min-w-[140px]" />
        <button disabled={busy} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm divide-y divide-amber-50">
        {customers.length === 0 && <p className="p-8 text-center text-gray-400 text-sm">Aucun client enregistré.</p>}
        {customers.map((c) => (
          <div key={c.id} className="p-3 flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-400">{c.phone}</p>
            </div>
            {c.phone && (
              <a
                href={`https://wa.me/228${c.phone.replace(/[^\d]/g, "").replace(/^228/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-emerald-50 text-emerald-700 rounded-lg"
                title="Contacter sur WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
