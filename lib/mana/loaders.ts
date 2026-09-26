/**
 * Primitivas de carga en Postgres compartidas por dos sitios: el cargador masivo del
 * archivo (`scripts/load.ts`, relee HTML ya archivado en disco) y la carga puntual de
 * un torneo desde el panel de admin (`lib/mana/loadTournament.ts`, va a buscar la
 * página en vivo). Las dos necesitan exactamente lo mismo para resolver jugadores y
 * eventos — jugador/evento nuevo, jugador/evento ya visto con nombre cambiado — así que
 * vive en un solo sitio en vez de mantener dos copias que puedan divergir.
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { sources, players, playerAliases, events } from "@/db/schema";

export const SOURCE_SLUG = "mana";
export const CHUNK_SIZE = 500;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function normalizeEventName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function ensureSource(): Promise<number> {
  const existing = await db.select().from(sources).where(eq(sources.slug, SOURCE_SLUG));
  if (existing.length > 0) return existing[0].id;
  const [row] = await db
    .insert(sources)
    .values({ slug: SOURCE_SLUG, name: "Mana Games" })
    .returning({ id: sources.id });
  return row.id;
}

export interface PlayerMapEntry {
  playerId: number;
  displayName: string;
}

export async function loadPlayerMap(sourceId: number): Promise<Map<string, PlayerMapEntry>> {
  const rows = await db
    .select({
      externalId: playerAliases.externalId,
      playerId: playerAliases.playerId,
      displayName: playerAliases.displayName,
    })
    .from(playerAliases)
    .where(eq(playerAliases.sourceId, sourceId));
  const map = new Map<string, PlayerMapEntry>();
  for (const r of rows) map.set(r.externalId, { playerId: r.playerId, displayName: r.displayName });
  return map;
}

/** Crea jugadores/alias nuevos en bloque para externalId no vistos. Actualiza `map` in place. */
export async function ensurePlayers(
  sourceId: number,
  refs: Map<string, string>,
  map: Map<string, PlayerMapEntry>,
): Promise<void> {
  const toCreate = [...refs.entries()].filter(([externalId]) => !map.has(externalId));

  for (const batch of chunk(toCreate, CHUNK_SIZE)) {
    const newPlayers = await db
      .insert(players)
      .values(batch.map(([, displayName]) => ({ displayName })))
      .returning({ id: players.id });
    const aliasRows = batch.map(([externalId, displayName], i) => ({
      playerId: newPlayers[i].id,
      sourceId,
      externalId,
      displayName,
    }));
    await db.insert(playerAliases).values(aliasRows);
    batch.forEach(([externalId, displayName], i) => {
      map.set(externalId, { playerId: newPlayers[i].id, displayName });
    });
  }

  // Nombre visible cambiado para un jugador ya conocido: poco frecuente, uno a uno.
  for (const [externalId, displayName] of refs) {
    const entry = map.get(externalId);
    if (entry && entry.displayName !== displayName) {
      await db
        .update(playerAliases)
        .set({ displayName })
        .where(and(eq(playerAliases.sourceId, sourceId), eq(playerAliases.externalId, externalId)));
      await db.update(players).set({ displayName }).where(eq(players.id, entry.playerId));
      entry.displayName = displayName;
    }
  }
}

export interface EventMapEntry {
  id: number;
  displayName: string;
}

export async function loadEventMap(sourceId: number): Promise<Map<string, EventMapEntry>> {
  const rows = await db.select().from(events).where(eq(events.sourceId, sourceId));
  const map = new Map<string, EventMapEntry>();
  for (const r of rows) map.set(r.normalizedName, { id: r.id, displayName: r.displayName });
  return map;
}

export async function ensureEvents(
  sourceId: number,
  refs: Map<string, string>,
  map: Map<string, EventMapEntry>,
): Promise<void> {
  const toCreate = [...refs.entries()].filter(([norm]) => !map.has(norm));

  for (const batch of chunk(toCreate, CHUNK_SIZE)) {
    const rows = await db
      .insert(events)
      .values(batch.map(([normalizedName, displayName]) => ({ sourceId, normalizedName, displayName })))
      .returning({ id: events.id, normalizedName: events.normalizedName });
    rows.forEach((r, i) => map.set(r.normalizedName, { id: r.id, displayName: batch[i][1] }));
  }

  for (const [normalizedName, displayName] of refs) {
    const entry = map.get(normalizedName);
    if (entry && entry.displayName !== displayName) {
      await db.update(events).set({ displayName }).where(eq(events.id, entry.id));
      entry.displayName = displayName;
    }
  }
}
