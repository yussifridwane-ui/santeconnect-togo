"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  Building2,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Clock,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Zap,
  ShieldCheck,
  Receipt,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  {
    label: "Tableau de bord",
    icon: LayoutDashboard,
    href: "/dashboard",
    roles: ["admin", "doctor", "nurse", "secretary", "patient"],
  },
  {
    label: "Patients",
    icon: Users,
    href: "/dashboard/patients",
    roles: ["admin", "doctor", "nurse", "secretary"],
  },
  {
    label: "Rendez-vous",
    icon: Calendar,
    href: "/dashboard/appointments",
    roles: ["admin", "doctor", "nurse", "secretary", "patient"],
  },
  {
    label: "Messagerie",
    icon: MessageSquare,
    href: "/dashboard/messages",
    roles: ["admin", "doctor", "nurse", "secretary"],
  },
  {
    label: "Établissements",
    icon: Building2,
    href: "/dashboard/facilities",
    roles: ["admin"],
  },
  {
    label: "Dossiers Médicaux",
    icon: FileText,
    href: "/dashboard/records",
    roles: ["admin", "doctor", "nurse"],
  },
  {
    label: "Facturation patients",
    icon: Receipt,
    href: "/dashboard/facturation",
    roles: ["admin", "secretary"],
  },
  {
    label: "Équipe",
    icon: UserCog,
    href: "/dashboard/team",
    roles: ["admin"],
  },
  {
    label: "Mon abonnement",
    icon: CreditCard,
    href: "/dashboard/billing",
    roles: ["admin", "doctor", "nurse", "secretary"],
  },
  {
    label: "Automatisation",
    icon: Zap,
    href: "/dashboard/automation",
    roles: ["admin"],
  },
  {
    label: "Journal de sécurité",
    icon: ShieldCheck,
    href: "/dashboard/audit",
    roles: ["admin"],
  },
  {
    label: "Paramètres",
    icon: Settings,
    href: "/dashboard/settings",
    roles: ["admin", "doctor", "nurse", "secretary", "patient"],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || "patient")
  );

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrateur",
    doctor: "Médecin",
    nurse: "Infirmier(ère)",
    secretary: "Secrétaire",
    patient: "Patient",
    pharmacist: "Pharmacien",
    lab: "Laboratoire",
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-emerald-700 text-white shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen bg-gradient-to-b from-emerald-800 to-emerald-900 text-white
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
          ${expanded ? "lg:w-64" : "lg:w-20"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-emerald-700/50">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <HeartPulseIcon />
          </div>
          {expanded && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm leading-tight">SantéOnline</h1>
              <p className="text-xs text-emerald-200">Togo</p>
            </div>
          )}
          <button
            className="ml-auto hidden lg:block text-emerald-200 hover:text-white"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/30 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold">
                {user?.fullName?.charAt(0) || "U"}
              </span>
            </div>
            {expanded && (
              <div className="overflow-hidden min-w-0">
                <p className="text-sm font-medium truncate">{user?.fullName}</p>
                <p className="text-xs text-emerald-200 truncate">
                  {ROLE_LABELS[user?.role || "patient"] || user?.role}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${
                    isActive
                      ? "bg-white/20 text-white font-medium"
                      : "text-emerald-100 hover:bg-white/10"
                  }
                `}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-emerald-700/50">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-emerald-100 hover:bg-red-500/20 hover:text-red-200 w-full transition-colors"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {expanded && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Spacer */}
      <div
        className={`
          hidden lg:block flex-shrink-0 transition-all duration-300
          ${expanded ? "w-64" : "w-20"}
        `}
      />
    </>
  );
}

function HeartPulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l.77.78 7.65 7.65 7.65-7.65.78-.78a5.4 5.4 0 0 0 0-7.65z" />
      <path d="M3.5 12h4l2-5 3 10 2-5h4" />
    </svg>
  );
}
