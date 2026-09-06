"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { editions, nativeTournamentRegistrations, sources } from "@/db/schema";
import { requireUser, getLinkedPlayerId } from "@/lib/auth";
import { NATIVE_SOURCE_SLUG } from "@/lib/nativeTournaments/source";

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
