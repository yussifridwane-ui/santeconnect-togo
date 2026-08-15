"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, Heart } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");

  const [registerData, setRegisterData] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "doctor", // default to medical cabinet doctor
    facilityId: "",
    createFacilityName: "",
    facilityCity: "Lomé",
    facilityAddress: "",
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const { register: registerUser } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");
    try {
      await registerUser(registerData);
      router.push("/dashboard");
    } catch (err: any) {
      setRegisterError(err.message || "Erreur d'inscription");
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Left Side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-700 to-emerald-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SantéOnline</h1>
              <p className="text-emerald-200 text-sm">Togo</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-4">
            Votre système de gestion
            <br />
            de santé connecté
          </h2>
          <p className="text-lg text-emerald-100 max-w-md">
            Plateforme complète pour les cliniques, laboratoires et hôpitaux du
            Togo. Messagerie, rendez-vous automatiques et suivi médical.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  d="M22 12h-4l-3 9L9 3l-3 9H2"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>
              Suivi en temps réel de la santé des patients
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                  strokeWidth="2"
                />
                <line
                  x1="16"
                  y1="2"
                  x2="16"
                  y2="6"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="8"
                  y1="2"
                  x2="8"
                  y2="6"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="3"
                  y1="10"
                  x2="21"
                  y2="10"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <span>Planification automatique des rendez-vous</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>Messagerie sécurisée entre professionnels et patients</span>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Heart size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SantéOnline</h1>
              <p className="text-emerald-600 text-sm">Togo</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-8">
            <button
              onClick={() => setTab("login")}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
                tab === "login"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setTab("register")}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
                tab === "register"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              Inscription
            </button>
          </div>

          {tab === "login" ? (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bon retour !
              </h2>
              <p className="text-gray-500 mb-8">
                Connectez-vous à votre compte SantéOnline
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.tg"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    "Se connecter"
                  )}
                </button>
              </form>

            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Créer un compte
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Rejoignez SantéOnline Togo en quelques instants
              </p>

              {registerError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
                  {registerError}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Role Picker */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Qui êtes-vous ?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterData({ ...registerData, role: "doctor" })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                        registerData.role === "doctor"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Cabinet Médical
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterData({ ...registerData, role: "patient" })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                        registerData.role === "patient"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Patient
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet *
                  </label>
                  <input
                    required
                    placeholder="Ex: Dr. Koffi Mensah"
                    value={registerData.fullName}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        fullName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: contact@moncabinet.tg"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    placeholder="Ex: +228 90 12 34 56"
                    value={registerData.phone}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Cabinet setup if Role is doctor/professional */}
                {registerData.role === "doctor" && (
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-3">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Configuration du Cabinet Médical
                    </p>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Nom de votre Cabinet *
                      </label>
                      <input
                        required
                        placeholder="Ex: Clinique Saint-Joseph, Cabinet Bien-Être"
                        value={registerData.createFacilityName}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            createFacilityName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Ville *
                        </label>
                        <input
                          required
                          placeholder="Lomé, Kara, etc."
                          value={registerData.facilityCity}
                          onChange={(e) =>
                            setRegisterData({
                              ...registerData,
                              facilityCity: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Adresse *
                        </label>
                        <input
                          required
                          placeholder="Bld de la Paix"
                          value={registerData.facilityAddress}
                          onChange={(e) =>
                            setRegisterData({
                              ...registerData,
                              facilityAddress: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={registerData.password}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        password: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registerLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {registerLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Créer mon Cabinet & Compte"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
