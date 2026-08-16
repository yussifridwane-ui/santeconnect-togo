"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";

/**
 * 🔔 Centre de notifications (V2.5) — rappels automatisés :
 * RDV confirmés/annulés, demandes de RDV en ligne, paiements reçus,
 * factures en retard. Rafraîchi toutes les 60 s, zéro intervention humaine.
 */
interface Notif {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items || []);
      setUnread(d.unreadCount || 0);
    } catch {
      /* silencieux : la cloche ne doit jamais casser l'interface */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  };

  const openItem = async (n: Notif) => {
    if (!n.is_read) {
      fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).then(load);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-emerald-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="font-bold text-gray-800 text-sm">🔔 Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-emerald-700 font-semibold flex items-center gap-1 hover:underline"
              >
                <CheckCheck size={14} /> Tout marquer lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">
                Aucune notification pour le moment.
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-emerald-50/50 transition-colors ${
                  n.is_read ? "opacity-60" : ""
                }`}
              >
                <p className="text-sm font-semibold text-gray-800 flex items-start gap-2">
                  {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                  <span>{n.title}</span>
                </p>
                {n.body && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>}
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString("fr-FR", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
