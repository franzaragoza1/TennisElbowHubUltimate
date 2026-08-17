"use server";

import { asc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { playerAliases, players, sources } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";

export interface PlayerSearchRow {
  id: number;
  displayName: string;
  country: string | null;
  countryOverride: string | null;
  aliasCount: number;
}

/** Lista de jugadores para el buscador del panel — unos cientos de filas
 * (CLAUDE.md §1), sin paginar. `q` filtra por nombre, insensible a mayúsculas. */
export async function searchPlayers(q: string): Promise<PlayerSearchRow[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: players.id,
      displayName: players.displayName,
      country: players.country,
      countryOverride: players.countryOverride,
      aliasCount: sql<number>`count(${playerAliases.id})::int`,
    })
    .from(players)
    .leftJoin(playerAliases, eq(playerAliases.playerId, players.id))
    .where(q ? sql`${players.displayName} ILIKE ${`%${q}%`}` : undefined)
    .groupBy(players.id)
    .orderBy(asc(players.displayName));

  return rows;
}

export interface PlayerAliasRow {
  id: number;
  sourceSlug: string;
  externalId: string;
  displayName: string;
}

export interface PlayerAdminDetail {
  id: number;
  displayName: string;
  country: string | null;
  countryOverride: string | null;
  aliases: PlayerAliasRow[];
}

export async function getPlayerAdminDetail(playerId: number): Promise<PlayerAdminDetail | null> {
  await requireAdmin();

  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) return null;

  const aliases = await db
    .select({
      id: playerAliases.id,
      sourceSlug: sources.slug,
      externalId: playerAliases.externalId,
      displayName: playerAliases.displayName,
    })
    .from(playerAliases)
    .innerJoin(sources, eq(sources.id, playerAliases.sourceId))
    .where(eq(playerAliases.playerId, playerId))
    .orderBy(asc(playerAliases.displayName));

  return {
    id: player.id,
    displayName: player.displayName,
    country: player.country,
    countryOverride: player.countryOverride,
    aliases,
  };
}

export interface OtherPlayerRow {
  id: number;
  displayName: string;
}

/** Todos los jugadores salvo uno — candidatos para reasignar un alias. */
export async function getOtherPlayers(excludePlayerId: number): Promise<OtherPlayerRow[]> {
  await requireAdmin();
  return db
    .select({ id: players.id, displayName: players.displayName })
    .from(players)
    .where(ne(players.id, excludePlayerId))
    .orderBy(asc(players.displayName));
}

/** Nacionalidad MOSTRADA, sin tocar la real (`players.country`, que reescribe el
 * importador en cada `npm run load`). Vacío = sin override, vuelve a mostrarse la real. */
export async function updateCountryOverride(formData: FormData): Promise<void> {
  await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) redirect("/admin/players");

  const raw = String(formData.get("countryOverride") ?? "").trim();
  await db
    .update(players)
    .set({ countryOverride: raw === "" ? null : raw })
    .where(eq(players.id, playerId));

  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/admin/players");
  revalidatePath("/rankings");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
}

/**
 * Mueve UN alias a otro jugador — la mitad manual de la reconciliación de
 * identidades que CLAUDE.md §3 pide ("semiautomática con confirmación manual").
 * El jugador que se queda sin alias NO se borra: partidos ya importados pueden
 * seguir apuntando a su `id` directamente (player1Id/winnerId/etc.), no solo a
 * través de `player_aliases`.
 */
export async function reassignAlias(formData: FormData): Promise<void> {
  await requireAdmin();
  const aliasId = Number(formData.get("aliasId"));
  const targetPlayerId = Number(formData.get("targetPlayerId"));
  const currentPlayerId = Number(formData.get("currentPlayerId"));
  if (!Number.isInteger(aliasId) || !Number.isInteger(targetPlayerId)) redirect(`/admin/players/${currentPlayerId}`);

  await db.update(playerAliases).set({ playerId: targetPlayerId }).where(eq(playerAliases.id, aliasId));

  revalidatePath(`/admin/players/${currentPlayerId}`);
  revalidatePath(`/admin/players/${targetPlayerId}`);
  revalidatePath("/admin/players");
}
