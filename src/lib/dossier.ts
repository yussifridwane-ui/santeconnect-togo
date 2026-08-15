import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";

/**
 * Jeton de DÉVERROUILLAGE DE DOSSIER — V2.2 (style T-Money).
 * Le patient tape son code → il reçoit un jeton signé, valable 15 minutes,
 * qui n'ouvre QUE son propre dossier. Le code lui-même n'est jamais stocké
 * en clair (bcrypt dans patients.dossier_code_hash).
 */
const KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "togo-health-messaging-secret-key-2024"
);

export async function signDossierToken(patientId: number, userId: number): Promise<string> {
  return new SignJWT({ scope: "dossier", pid: patientId, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(KEY);
}

/** True uniquement si le jeton: valide, porté scope "dossier", ET pour CE dossier + CET utilisateur. */
export async function verifyDossierToken(
  request: NextRequest,
  patientId: number,
  userId: number
): Promise<boolean> {
  const token = request.headers.get("x-dossier-token");
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload.scope === "dossier" && payload.pid === patientId && payload.uid === userId;
  } catch {
    return false;
  }
}
