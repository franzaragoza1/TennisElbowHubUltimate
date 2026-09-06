import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { NATIVE_SOURCE_SLUG } from "@/lib/nativeTournaments/source";
import { getNativeSecuredPointsByPlayer } from "./securedPoints";
import { getOngoingNativeEditionIds } from "./nativeWeek";
import { rollingWindowStart } from "./rollingWindow";
import { rankByPoints, type RankedEntry } from "./officialRanking";
import { mergeOngoingPoints } from "./liveRanking";
import { filterAndRerankNextGen } from "./nextGenRanking";

export interface NativeRankedPlayer {
  rank: number;
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  points: number;
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/**
 * Ediciones nativas TERMINADAS (ronda `F` decidida) dentro de la ventana rolling de
 * 52 semanas — la fecha se filtra en JS con `isWithinRollingWindow`
 * (rollingWindow.ts, ya probada) en vez de en SQL, para no reimplementar la regla
 * del borde en dos sitios.
 */
async function getCompletedNativeEditionIdsInWindow(asOf: Date): Promise<number[]> {
  const result = await db.execute(sql`
    SELECT e.id AS edition_id, e.week_start_date
    FROM editions e
    JOIN sources s ON s.id = e.source_id
    WHERE s.slug = ${NATIVE_SOURCE_SLUG}
      AND e.week_start_date IS NOT NULL
      AND EXISTS(SELECT 1 FROM matches mf WHERE mf.edition_id = e.id AND mf.round = 'F')
  `);
  const start = rollingWindowStart(asOf);
  return rowsOf<{ edition_id: number; week_start_date: string }>(result)
    .filter((row) => {
      const week = new Date(row.week_start_date);
      return week.getTime() >= start.getTime() && week.getTime() <= asOf.getTime();
    })
    .map((row) => Number(row.edition_id));
}

async function attachPlayerInfo(ranked: RankedEntry[]): Promise<NativeRankedPlayer[]> {
  if (ranked.length === 0) return [];
  const rows = await db
    .select({
      id: players.id,
      displayName: players.displayName,
      country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
      character: players.character,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(inArray(players.id, ranked.map((r) => r.playerId)));
  const infoById = new Map(rows.map((r) => [r.id, r]));

  return ranked
    .map((entry) => {
      const info = infoById.get(entry.playerId);
      if (!info) return null;
      return { ...entry, displayName: info.displayName, country: info.country, character: info.character, avatarUrl: info.avatarUrl };
    })
    .filter((row): row is NativeRankedPlayer => row !== null);
}

/** Suma de puntos asegurados en ediciones nativas COMPLETADAS dentro de la ventana
 * rolling de 52 semanas — recalculado en cada lectura, nunca un snapshot guardado
 * (ver docs/decisiones.md, "Fresh start": el ranking nativo empieza de cero, no
 * hereda ni mezcla nada de `ranking_snapshots`). */
export async function getNativeOfficialRanking(asOf: Date = new Date()): Promise<NativeRankedPlayer[]> {
  const editionIds = await getCompletedNativeEditionIdsInWindow(asOf);
  const secured = await getNativeSecuredPointsByPlayer(editionIds);
  const ranked = rankByPoints([...secured.entries()].map(([playerId, entry]) => ({ playerId, points: entry.points })));
  return attachPlayerInfo(ranked);
}

/** Official + puntos asegurados en ediciones nativas EN CURSO ahora mismo — pura
 * suma, sin resta de nada (a diferencia del motor de Mana, que sí expira puntos de
 * un snapshot). Se parte del universo COMPLETO del Official (no un top-N) para que
 * un debutante en curso pueda entrar al ranking visible. */
export async function getNativeLiveRanking(asOf: Date = new Date()): Promise<NativeRankedPlayer[]> {
  const completedEditionIds = await getCompletedNativeEditionIdsInWindow(asOf);
  const official = await getNativeSecuredPointsByPlayer(completedEditionIds);
  const officialEntries = [...official.entries()].map(([playerId, entry]) => ({ playerId, points: entry.points }));

  const ongoingEditionIds = await getOngoingNativeEditionIds();
  const ongoing = await getNativeSecuredPointsByPlayer(ongoingEditionIds);

  const merged = mergeOngoingPoints(officialEntries, ongoing);
  return attachPlayerInfo(rankByPoints(merged));
}

/** Mismo criterio que el Official nativo, filtrado a `players.startYear` ===
 * el año de `asOf` (pedido explícito: exacto, no un rango). */
export async function getNativeNextGenRanking(asOf: Date = new Date()): Promise<NativeRankedPlayer[]> {
  const editionIds = await getCompletedNativeEditionIdsInWindow(asOf);
  const secured = await getNativeSecuredPointsByPlayer(editionIds);
  const entries = [...secured.entries()].map(([playerId, entry]) => ({ playerId, points: entry.points }));

  const playerIds = entries.map((e) => e.playerId);
  const startYearByPlayer = new Map<number, number | null>();
  if (playerIds.length > 0) {
    const rows = await db
      .select({ id: players.id, startYear: players.startYear })
      .from(players)
      .where(inArray(players.id, playerIds));
    for (const row of rows) startYearByPlayer.set(row.id, row.startYear);
  }

  const ranked = filterAndRerankNextGen(entries, startYearByPlayer, asOf.getFullYear());
  return attachPlayerInfo(ranked);
}
