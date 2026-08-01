"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  facilityId: number | null;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    facilityId?: string;
    createFacilityName?: string;
    facilityCity?: string;
    facilityAddress?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setUser(data.user);
  };

  const register = async (data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    facilityId?: string;
    createFacilityName?: string;
    facilityCity?: string;
    facilityAddress?: string;
  }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    setUser(result.user);
  };

  const logout = async () => {
    await fetch("/api/auth/session", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
