"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { editions, nativeTournamentRegistrations, sources } from "@/db/schema";
import { requireUser, getCurrentUser, getLinkedPlayerId } from "@/lib/auth";
import { NATIVE_SOURCE_SLUG } from "@/lib/nativeTournaments/source";
import { getNextOpponentForPlayer, type NextOpponentResult } from "@/lib/nextOpponent";

export type RegisterResult = { ok: true } | { ok: false; error: string };

/**
 * Un usuario con jugador vinculado se apunta a un torneo NATIVO todavía en
 * inscripción — solo tiene sentido para torneos nativos (los de Mana no tienen cola
 * de inscripción propia, se registran en el foro real). Devuelve el error en vez de
 * `redirect()` porque lo llama un componente cliente (botón), no un `<form>`.
 */
export async function registerForTournament(editionId: number): Promise<RegisterResult> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) return { ok: false, error: "Link a player profile from your account page first." };

  const [edition] = await db
    .select({ sourceSlug: sources.slug })
    .from(editions)
    .innerJoin(sources, eq(sources.id, editions.sourceId))
    .where(eq(editions.id, editionId));
  if (!edition || edition.sourceSlug !== NATIVE_SOURCE_SLUG) return { ok: false, error: "This tournament isn't open for in-app registration." };

  const [existing] = await db
    .select({ id: nativeTournamentRegistrations.id })
    .from(nativeTournamentRegistrations)
    .where(and(eq(nativeTournamentRegistrations.editionId, editionId), eq(nativeTournamentRegistrations.playerId, playerId)));
  if (existing) return { ok: false, error: "Already registered." };

  await db.insert(nativeTournamentRegistrations).values({ editionId, playerId, status: "registered" });
  revalidatePath(`/tournaments/${editionId}`);
  return { ok: true };
}

/**
 * Pase de rendimiento (2026-09-13): antes `app/tournaments/[id]/page.tsx` resolvía
 * esto ella misma con `getCurrentUser()` en su propio render de servidor — cualquier
 * API dinámica (leer la cookie de sesión) en el árbol de una ruta la fuerza ENTERA a
 * SSR dinámico en Next.js, así que su `revalidate = 600` se quedaba en no-op: cada
 * visita repetía la consulta completa del cuadro/sets/vídeos/plazos, no solo la parte
 * de verdad personal. `NextOpponentPanel.tsx` ya era "use client" (recibía `info` ya
 * resuelto) — ahora se lo pide él mismo al montar, así la página no necesita tocar la
 * sesión en absoluto y su caché ISR vuelve a funcionar de verdad.
 */
export async function getMyNextOpponent(editionId: number): Promise<NextOpponentResult> {
  const user = await getCurrentUser();
  const playerId = user ? await getLinkedPlayerId(user.id) : null;
  if (!playerId) return { status: "none" };
  return getNextOpponentForPlayer(playerId, editionId);
}
