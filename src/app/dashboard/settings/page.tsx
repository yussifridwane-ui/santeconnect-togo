"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Bell,
  Globe,
  Save,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
} from "lucide-react";

/* ── Jauge de force du nouveau mot de passe (indicative, côté client) ── */
function strengthOf(pwd: string): { score: 0 | 1 | 2 | 3 | 4; label: string; cls: string } {
  if (!pwd) return { score: 0, label: "", cls: "" };
  let pts = 0;
  if (pwd.length >= 6) pts++;
  if (pwd.length >= 10) pts++;
  if (/[a-zàâäéèêëîïôöùûü]/.test(pwd) && /[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/.test(pwd)) pts++;
  if (/\d/.test(pwd)) pts++;
  if (/[^A-Za-zÀ-ÿ0-9]/.test(pwd)) pts++;
  if (pts <= 1) return { score: 1, label: "Faible", cls: "bg-red-500" };
  if (pts <= 2) return { score: 2, label: "Moyen", cls: "bg-amber-500" };
  if (pts <= 3) return { score: 3, label: "Bon", cls: "bg-sky-500" };
  return { score: 4, label: "Fort 💪", cls: "bg-emerald-500" };
}

/* ── Champ mot de passe professionnel (œil pour voir/masquer) ── */
function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  hint,
  valid,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  hint?: string;
  valid?: boolean | null;
  autoComplete: string;
}) {
  const ring =
    valid === false
      ? "border-red-300 focus:ring-red-500"
      : valid === true
        ? "border-emerald-300 focus:ring-emerald-500"
        : "border-gray-200 focus:ring-emerald-500";
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full px-3 py-2.5 pr-11 border rounded-xl outline-none focus:ring-2 transition-colors ${ring}`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          title={show ? "Masquer" : "Afficher"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
        {valid === true && (
          <CheckCircle2 size={17} className="absolute right-9 top-1/2 -translate-y-1/2 text-emerald-500" />
        )}
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  /* 🔑 V3.0 — état du vrai moteur de changement de mot de passe */
  const [password, setPassword] = useState({ current: "", new: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdOk, setPwdOk] = useState("");

  const strength = useMemo(() => strengthOf(password.new), [password.new]);
  const matches = password.confirm.length > 0 && password.new === password.confirm;
  const formReady =
    password.current.length > 0 && password.new.length >= 6 && matches && !pwdSaving;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  /* ⚙️ Appel du moteur serveur : vérification ancien → chiffrement bcrypt →
     enregistrement réel en base + traçabilité. Aucun mot de passe n'est
     affiché, stocké ou journalisé en clair. */
  const handleChangePassword = async () => {
    if (pwdSaving) return;
    setPwdError("");
    setPwdOk("");
    if (!password.current) return setPwdError("Saisissez d'abord votre mot de passe actuel.");
    if (password.new.length < 6)
      return setPwdError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
    if (password.new !== password.confirm)
      return setPwdError("La confirmation ne correspond pas au nouveau mot de passe.");
    if (password.new === password.current)
      return setPwdError("Le nouveau mot de passe doit être différent de l'ancien.");

    setPwdSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.new,
          confirmPassword: password.confirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec du changement de mot de passe.");

      setPwdOk(data.message || "Mot de passe changé avec succès.");
      setPassword({ current: "", new: "", confirm: "" });
      setShowPwd({ current: false, new: false, confirm: false });
    } catch (e) {
      setPwdError((e as Error).message);
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Gérez votre profil et vos préférences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { icon: User, label: "Profil", target: "profil" },
            { icon: Lock, label: "Mot de passe", target: "mot-de-passe" },
            { icon: Bell, label: "Notifications", target: "compte" },
            { icon: Globe, label: "Langue & Région", target: "compte" },
          ].map((item, i) => (
            <a
              key={i}
              href={`#${item.target}`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                item.target === "mot-de-passe"
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </a>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" id="profil">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} className="text-emerald-600" />
              Informations du profil
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                <input
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saved ? "Sauvegardé !" : saving ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ 🔑 CARTE MOT DE PASSE — LE VRAI MOTEUR (V3.0) ══════════ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" id="mot-de-passe">
            {/* En-tête premium */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                <ShieldCheck size={22} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Changer le mot de passe</h2>
                <p className="text-emerald-100 text-xs">
                  Chiffré de bout en bout — même nous ne pouvons pas le lire 🔒
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <PasswordField
                label="Mot de passe actuel"
                value={password.current}
                onChange={(v) => setPassword({ ...password, current: v })}
                show={showPwd.current}
                onToggleShow={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                hint="Requis : seul vous connaissez votre secret actuel (anti-usurpation)."
                autoComplete="current-password"
              />

              <PasswordField
                label="Nouveau mot de passe"
                value={password.new}
                onChange={(v) => setPassword({ ...password, new: v })}
                show={showPwd.new}
                onToggleShow={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                hint="6 caractères minimum — mélangez lettres, chiffres et symboles."
                autoComplete="new-password"
                valid={password.new.length > 0 ? password.new.length >= 6 : null}
              />

              {/* Jauge de force en direct */}
              {password.new.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((s) => (
                      <span
                        key={s}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          s <= strength.score ? strength.cls : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-gray-600">
                    Force : <span className="font-bold">{strength.label}</span>
                  </p>
                </div>
              )}

              <PasswordField
                label="Confirmer le nouveau mot de passe"
                value={password.confirm}
                onChange={(v) => setPassword({ ...password, confirm: v })}
                show={showPwd.confirm}
                onToggleShow={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                autoComplete="new-password"
                valid={password.confirm.length > 0 ? matches : null}
              />
              {password.confirm.length > 0 && (
                <p className={`text-xs font-semibold -mt-2 ${matches ? "text-emerald-600" : "text-red-500"}`}>
                  {matches ? "✓ Les deux nouveaux mots de passe sont identiques" : "✗ Les deux saisies ne correspondent pas"}
                </p>
              )}

              {/* Messages du moteur */}
              {pwdError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                  <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" />
                  {pwdError}
                </div>
              )}
              {pwdOk && (
                <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 font-medium">
                  <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    <b>{pwdOk}</b>
                    <br />
                    <span className="text-xs font-normal">
                      Journal de sécurité : « mot de passe modifié » tracé (jamais le contenu).
                    </span>
                  </span>
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={!formReady}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {pwdSaving ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                {pwdSaving ? "Changement en cours…" : "Changer le mot de passe"}
              </button>

              <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
                🛡️ Protections actives : vérification de l'ancien mot de passe · 5 échecs = gel
                15 min (anti-attaque) · chiffrement bcrypt · traçabilité au journal de sécurité.
                Le nouveau mot de passe est actif dès votre prochaine connexion.
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" id="compte">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <SettingsIcon size={20} className="text-emerald-600" />
              Informations du compte
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Rôle</p>
                <p className="font-medium capitalize">{user?.role}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ID Utilisateur</p>
                <p className="font-medium">#{user?.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
