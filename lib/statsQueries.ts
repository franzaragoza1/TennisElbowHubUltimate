/**
 * Leaderboards agregados sobre `match_stats` — solo tiene datos reales desde que
 * existe `lib/matchLog/*` (ver docs/decisiones.md, 2026-08-16: antes de eso la tabla
 * estaba completamente vacía). Los porcentajes se calculan sobre la SUMA de numerador
 * y denominador de todos los partidos de un jugador, nunca como media de sus
 * porcentajes partido a partido — es la forma correcta estadísticamente y es la misma
 * que usa la propia ATP.
 *
 * Estructura agrupada en tres categorías (Serve / Return / Under Pressure), como los
 * "Stats Leaderboards" reales de ATP. Cada una lleva un "Rating" de cabecera para
 * poder ordenar por una sola cifra (pedido explícito) — pero, a diferencia del de la
 * ATP (una fórmula propietaria suya, opaca, que no podemos ni queremos replicar), el
 * nuestro es la SUMA lisa y llana de los porcentajes reales que ya se enseñan en esa
 * misma tabla (ver `sumPct` más abajo): nunca esconde un número que el propio jugador
 * no pueda reconstruir a mano sumando las columnas que tiene delante. Columnas
 * de la referencia que no podemos construir sin adivinar (p.ej. "% Service Games Won"
 * necesitaría saber quién sacaba en cada juego, dato que el MatchLog no da) simplemente
 * no están, en vez de rellenarse con una aproximación inventada.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { matchStats, players } from "@/db/schema";

/**
 * Mínimo de partidos con estadística registrada para entrar en un leaderboard —
 * sin esto, un jugador con un solo partido y un 100% real se colaría por delante de
 * quien lleva decenas de partidos con un 70% de verdad. Mismo espíritu que el mínimo
 * de partidos jugados de los Stats Leaders reales de la ATP — cifra elegida a mano,
 * fácil de ajustar si hace falta.
 */
const MIN_MATCHES = 5;

interface PlayerCols {
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  matchesCounted: number;
}

export interface ServeLeaderRow extends PlayerCols {
  serveRating: number;
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  acesPerMatch: number | null;
  doubleFaultsPerMatch: number | null;
  fastestServeKmh: number | null;
}

export interface ReturnLeaderRow extends PlayerCols {
  returnRating: number;
  returnPointsWonPct: number | null;
  breakPointsWonPct: number | null;
}

export interface PressureLeaderRow extends PlayerCols {
  pressureRating: number;
  breakPointsWonPct: number | null;
  breakPointsSavedPct: number | null;
}

/** Suma de porcentajes reales, cero cuando falta alguno — nunca `null`, así que
 * siempre hay por dónde ordenar (a diferencia de una columna individual, que sí puede
 * faltar). `Rating` es la cabecera de la tabla, no puede quedarse en blanco. */
function sumPct(...values: (number | null)[]): number {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0);
}

const playerSelect = {
  playerId: players.id,
  displayName: players.displayName,
  country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
  character: players.character,
  avatarUrl: players.avatarUrl,
  matchesCounted: sql<number>`count(*)::int`,
};

export async function getServeLeaders(limit: number): Promise<ServeLeaderRow[]> {
  const rows = await db
    .select({
      ...playerSelect,
      firstServePct: sql<number | null>`round(100.0 * sum(${matchStats.firstServeIn}) / nullif(sum(${matchStats.firstServeAttempted}), 0), 1)::float8`,
      firstServeWonPct: sql<number | null>`round(100.0 * sum(${matchStats.firstServePointsWon}) / nullif(sum(${matchStats.firstServePointsPlayed}), 0), 1)::float8`,
      secondServeWonPct: sql<number | null>`round(100.0 * sum(${matchStats.secondServePointsWon}) / nullif(sum(${matchStats.secondServePointsPlayed}), 0), 1)::float8`,
      acesPerMatch: sql<number | null>`round(sum(${matchStats.aces})::numeric / count(*), 1)::float8`,
      doubleFaultsPerMatch: sql<number | null>`round(sum(${matchStats.doubleFaults})::numeric / count(*), 1)::float8`,
      fastestServeKmh: sql<number | null>`max(${matchStats.fastestServeKmh})`,
    })
    .from(matchStats)
    .innerJoin(players, eq(players.id, matchStats.playerId))
    .groupBy(players.id)
    .having(sql`count(*) >= ${MIN_MATCHES}`);
  // Sin LIMIT aquí a propósito: el Rating se calcula EN JS a partir de columnas ya
  // traídas (ver sumPct arriba), así que recortar en SQL antes de calcularlo podría
  // dejar fuera a alguien que solo destaca en el Rating combinado, no en ningún
  // percentil individual. El universo entero de jugadores con datos es de unos
  // cientos (CLAUDE.md §1), así que traerlo entero y recortar después es barato.

  return rows
    .map((r) => ({ ...r, serveRating: sumPct(r.firstServePct, r.firstServeWonPct, r.secondServeWonPct) }))
    .sort((a, b) => b.serveRating - a.serveRating)
    .slice(0, limit);
}

export async function getReturnLeaders(limit: number): Promise<ReturnLeaderRow[]> {
  const rows = await db
    .select({
      ...playerSelect,
      returnPointsWonPct: sql<number | null>`round(100.0 * sum(${matchStats.returnPointsWon}) / nullif(sum(${matchStats.returnPointsPlayed}), 0), 1)::float8`,
      breakPointsWonPct: sql<number | null>`round(100.0 * sum(${matchStats.breakPointsWon}) / nullif(sum(${matchStats.breakPointsFaced}), 0), 1)::float8`,
    })
    .from(matchStats)
    .innerJoin(players, eq(players.id, matchStats.playerId))
    .groupBy(players.id)
    .having(sql`count(*) >= ${MIN_MATCHES}`);

  return rows
    .map((r) => ({ ...r, returnRating: sumPct(r.returnPointsWonPct, r.breakPointsWonPct) }))
    .sort((a, b) => b.returnRating - a.returnRating)
    .slice(0, limit);
}

/**
 * "Break points saved" (de cara al saque) no es una columna propia de `match_stats` —
 * el MatchLog solo da "break points won" desde el punto de vista de quien resta (ver
 * db/schema.ts). Pero esa misma fila, leída desde el lado del RIVAL en ese partido, ES
 * exactamente "puntos de rotura enfrentados/salvados al saque" de este jugador — así
 * que se deriva con un self-join por `matchId`, dato real, nunca inventado.
 */
export async function getPressureLeaders(limit: number): Promise<PressureLeaderRow[]> {
  const opponent = alias(matchStats, "opponent_stats");

  const rows = await db
    .select({
      ...playerSelect,
      breakPointsWonPct: sql<number | null>`round(100.0 * sum(${matchStats.breakPointsWon}) / nullif(sum(${matchStats.breakPointsFaced}), 0), 1)::float8`,
      breakPointsSavedPct: sql<number | null>`round(100.0 * (sum(${opponent.breakPointsFaced}) - sum(${opponent.breakPointsWon})) / nullif(sum(${opponent.breakPointsFaced}), 0), 1)::float8`,
    })
    .from(matchStats)
    .innerJoin(players, eq(players.id, matchStats.playerId))
    .innerJoin(opponent, and(eq(opponent.matchId, matchStats.matchId), ne(opponent.playerId, matchStats.playerId)))
    .groupBy(players.id)
    .having(sql`count(*) >= ${MIN_MATCHES}`);

  return rows
    .map((r) => ({ ...r, pressureRating: sumPct(r.breakPointsSavedPct, r.breakPointsWonPct) }))
    .sort((a, b) => b.pressureRating - a.pressureRating)
    .slice(0, limit);
}

export interface StatShowcaseRow {
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  rating: number;
}

export interface StatsShowcase {
  serve: StatShowcaseRow[];
  return: StatShowcaseRow[];
  pressure: StatShowcaseRow[];
}

/** Top N de cada categoría, en la forma mínima que necesita el escaparate de la home
 * (components/stats/StatsLeadersShowcase.tsx) — mismas tres consultas de arriba, solo
 * recortadas a las columnas comunes que ese componente pinta. */
export async function getStatsShowcase(limit = 5): Promise<StatsShowcase> {
  const [serve, ret, pressure] = await Promise.all([getServeLeaders(limit), getReturnLeaders(limit), getPressureLeaders(limit)]);
  const pick = (r: PlayerCols, rating: number): StatShowcaseRow => ({
    playerId: r.playerId,
    displayName: r.displayName,
    country: r.country,
    character: r.character,
    avatarUrl: r.avatarUrl,
    rating,
  });
  return {
    serve: serve.map((r) => pick(r, r.serveRating)),
    return: ret.map((r) => pick(r, r.returnRating)),
    pressure: pressure.map((r) => pick(r, r.pressureRating)),
  };
}
