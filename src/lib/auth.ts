import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

/* 🔐 V2.8 — Durcissement : en PRODUCTION, le secret vient OBLIGATOIREMENT de
   l'environnement. Le secret de secours ne fonctionne qu'en développement local
   — jamais sur le site en ligne (empêche toute falsification de sessions). */
function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (s) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production" || process.env.NETLIFY) {
    throw new Error("JWT_SECRET manquant dans l'environnement de production");
  }
  return new TextEncoder().encode("dev-only-secret-do-not-use-in-production");
}

export interface UserSession {
  id: number;
  fullName: string;
  email: string;
  role: string;
  facilityId: number | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(user: UserSession): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

/* ⏱️ Rate limiting "best effort" en mémoire du processus (serverless : chaque
   instance a sa mémoire) — complété par les verrous PERSISTANTS en base
   (login, code dossier) qui eux survivent aux instances. Usage : endpoints
   opportunistes (register, messages…). */
const limiter = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (limiter.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  limiter.set(key, arr);
  return true;
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSession(user: UserSession): Promise<void> {
  const cookieStore = await cookies();
  const token = await createToken(user);
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
