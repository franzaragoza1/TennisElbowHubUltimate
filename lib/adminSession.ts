import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Puerta del panel de administración. Deliberadamente **independiente** de
 * `lib/session.ts`: aquella es una sesión de demo que no pide contraseña (cualquiera
 * puede entrar como cualquier jugador), así que colgar de ella la publicación de
 * noticias dejaría el panel abierto de par en par en una web pública.
 *
 * Sin estado en servidor: la cookie lleva su propia caducidad y una firma HMAC, así que
 * no se puede fabricar sin conocer ADMIN_SECRET.
 */
const COOKIE_NAME = "te4_admin";
const SESSION_MS = 1000 * 60 * 60 * 12;

function secret(): string | null {
  return process.env.ADMIN_SECRET || null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

/** Comparación en tiempo constante; distinta longitud se descarta antes de comparar. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export async function startAdminSession(): Promise<boolean> {
  const key = secret();
  if (!key) return false;

  const expiresAt = String(Date.now() + SESSION_MS);
  const store = await cookies();
  store.set(COOKIE_NAME, `${expiresAt}.${sign(expiresAt, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
  return true;
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const key = secret();
  if (!key) return false;

  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const [expiresAt, signature] = raw.split(".");
  if (!expiresAt || !signature) return false;
  if (!safeEqual(signature, sign(expiresAt, key))) return false;

  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}
