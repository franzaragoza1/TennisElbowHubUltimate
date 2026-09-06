"use server";

import { asc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { authUsers, playerAliases, playerKnownNames, players, sources } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { parseBulkKnownNames } from "@/lib/matchLog/parseBulkKnownNames";

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

export interface PlayerKnownNameRow {
  id: number;
  name: string;
}

export interface LinkedAccountInfo {
  userId: string;
  name: string | null;
  image: string | null;
}

export interface PlayerAdminDetail {
  id: number;
  displayName: string;
  country: string | null;
  countryOverride: string | null;
  aliases: PlayerAliasRow[];
  knownNames: PlayerKnownNameRow[];
  /** null = sin cuenta de Discord vinculada (el hueco normal para casi todo el
   * histórico importado — solo lo tienen los jugadores que se reclamaron o se crearon
   * desde /account). */
  linkedAccount: LinkedAccountInfo | null;
}

export async function getPlayerAdminDetail(playerId: number): Promise<PlayerAdminDetail | null> {
  await requireAdmin();

  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) return null;

  const [aliases, knownNames, linkedAccountRows] = await Promise.all([
    db
      .select({
        id: playerAliases.id,
        sourceSlug: sources.slug,
        externalId: playerAliases.externalId,
        displayName: playerAliases.displayName,
      })
      .from(playerAliases)
      .innerJoin(sources, eq(sources.id, playerAliases.sourceId))
      .where(eq(playerAliases.playerId, playerId))
      .orderBy(asc(playerAliases.displayName)),
    db
      .select({ id: playerKnownNames.id, name: playerKnownNames.name })
      .from(playerKnownNames)
      .where(eq(playerKnownNames.playerId, playerId))
      .orderBy(asc(playerKnownNames.name)),
    player.linkedUserId
      ? db.select({ id: authUsers.id, name: authUsers.name, image: authUsers.image }).from(authUsers).where(eq(authUsers.id, player.linkedUserId))
      : Promise.resolve([]),
  ]);
  const linkedAccountRow = linkedAccountRows[0];

  return {
    id: player.id,
    displayName: player.displayName,
    country: player.country,
    countryOverride: player.countryOverride,
    aliases,
    knownNames,
    linkedAccount: linkedAccountRow ? { userId: linkedAccountRow.id, name: linkedAccountRow.name, image: linkedAccountRow.image } : null,
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
 * Desvincula la cuenta de Discord de este jugador — pedido explícito: un admin tiene
 * que poder deshacer un `players.linkedUserId` ya puesto, no solo aprobar/rechazar
 * solicitudes NUEVAS (`app/admin/players/claims/actions.ts` ya cubre eso, pero no
 * tenía forma de deshacer un vínculo ya aprobado — p.ej. la persona ya no juega, se
 * reclamó el perfil equivocado, o hace falta liberarlo para que otro lo pida). El
 * jugador en sí NUNCA se borra, solo deja de estar vinculado a ninguna cuenta —
 * vuelve exactamente al mismo estado que un perfil histórico nunca reclamado.
 */
export async function unlinkPlayerAccount(formData: FormData): Promise<void> {
  await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) redirect("/admin/players");

  await db.update(players).set({ linkedUserId: null }).where(eq(players.id, playerId));

  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/admin/players");
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

/**
 * Variante de nombre conocida para este jugador — la mitad manual de
 * `lib/matchLog/nameIndex.ts`: un `MatchLog` local puede traer un nombre ya cambiado
 * (Mana sobrescribe el viejo sin dejar histórico) o un mote/abreviatura que nunca
 * cuadrará por exacto con `players.displayName`. Se añade una vez aquí y desde
 * entonces cualquier fichero (ya subido o futuro) que traiga ese nombre resuelve
 * solo — no hace falta volver a subir nada.
 */
export async function addPlayerKnownName(formData: FormData): Promise<void> {
  await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) redirect("/admin/players");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    revalidatePath(`/admin/players/${playerId}`);
    return;
  }

  await db.insert(playerKnownNames).values({ playerId, name }).onConflictDoNothing();
  revalidatePath(`/admin/players/${playerId}`);
}

export async function deletePlayerKnownName(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(id) || !Number.isInteger(playerId)) redirect("/admin/players");

  await db.delete(playerKnownNames).where(eq(playerKnownNames.id, id));
  revalidatePath(`/admin/players/${playerId}`);
}

export interface BulkKnownNamesOutcome {
  linked: { playerId: number; displayName: string; addedCount: number }[];
  failed: { nameQuery: string; reason: string }[];
  malformed: string[];
}

/**
 * Versión en lote de `addPlayerKnownName` — "Name: pastname, pastname2; Name:
 * pastname", un jugador por bloque (parseo puro en `lib/matchLog/parseBulkKnownNames.ts`).
 * El nombre de cada bloque se resuelve por EXACTO contra `players.displayName`
 * (insensible a mayúsculas) — cero o más de una coincidencia se reporta como fallo
 * de ese bloque, nunca se adivina cuál jugador es; el resto de bloques se procesa
 * igual aunque uno falle.
 */
export async function bulkAddKnownNames(
  _prevState: BulkKnownNamesOutcome,
  formData: FormData,
): Promise<BulkKnownNamesOutcome> {
  await requireAdmin();
  const raw = String(formData.get("bulkText") ?? "");
  const { blocks, malformed } = parseBulkKnownNames(raw);

  const linked: BulkKnownNamesOutcome["linked"] = [];
  const failed: BulkKnownNamesOutcome["failed"] = [];

  for (const block of blocks) {
    const rows = await db
      .select({ id: players.id, displayName: players.displayName })
      .from(players)
      .where(sql`lower(${players.displayName}) = lower(${block.nameQuery})`);

    if (rows.length === 0) {
      failed.push({ nameQuery: block.nameQuery, reason: "no player with that exact name" });
      continue;
    }
    if (rows.length > 1) {
      failed.push({ nameQuery: block.nameQuery, reason: "ambiguous — more than one player with that exact name" });
      continue;
    }

    const player = rows[0];
    await db
      .insert(playerKnownNames)
      .values(block.aliases.map((name) => ({ playerId: player.id, name })))
      .onConflictDoNothing();
    linked.push({ playerId: player.id, displayName: player.displayName, addedCount: block.aliases.length });
  }

  revalidatePath("/admin/players");
  for (const l of linked) revalidatePath(`/admin/players/${l.playerId}`);

  return { linked, failed, malformed };
}
