import { cookies } from "next/headers";

/**
 * Sesión de demo, sin contraseña: la cookie guarda directamente el `players.id`.
 * No es autenticación real — ver plan de la fase "login falso + editor de avatar".
 */
const COOKIE_NAME = "te4_session";

export async function getSessionPlayerId(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function setSession(playerId: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, String(playerId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
