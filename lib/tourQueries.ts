import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, events, matches, players, rankingSnapshots } from "@/db/schema";
import type { TournamentCardData } from "@/components/tournaments/TournamentCard";
import type { TournamentStatus } from "@/lib/tournamentStatus";

export interface IsoWeekRef {
  isoYear: number;
  isoWeek: number;
}

/** Última semana de ranking OFICIAL importada. Es el "ahora" del tour para toda la
 * web — la Race (`kind = 'race'`) tiene su propio calendario de semanas y no pinta
 * nada aquí. */
export async function getLatestRankingWeek(): Promise<IsoWeekRef | null> {
  const [row] = await db
    .select({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.kind, "official"))
    .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek))
    .limit(1);
  return row ?? null;
}

export interface RankedPlayer {
  rank: number;
  points: number;
  moved: number;
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
}

export async function getTopPlayers(week: IsoWeekRef, limit: number): Promise<RankedPlayer[]> {
  return db
    .select({
      rank: rankingSnapshots.rank,
      points: rankingSnapshots.points,
      moved: rankingSnapshots.moved,
      playerId: players.id,
      displayName: players.displayName,
      country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
      character: players.character,
    })
    .from(rankingSnapshots)
    .innerJoin(players, eq(players.id, rankingSnapshots.playerId))
    .where(
      and(
        eq(rankingSnapshots.kind, "official"),
        eq(rankingSnapshots.isoYear, week.isoYear),
        eq(rankingSnapshots.isoWeek, week.isoWeek),
      ),
    )
    .orderBy(rankingSnapshots.rank)
    .limit(limit);
}

/** Última semana de la Race importada — igual que `getLatestRankingWeek`, pero para
 * `kind = 'race'` (su propio calendario, ver docs/decisiones.md). */
export async function getLatestRaceWeek(): Promise<IsoWeekRef | null> {
  const [row] = await db
    .select({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.kind, "race"))
    .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek))
    .limit(1);
  return row ?? null;
}

interface NextGenRow {
  rank: number;
  points: number;
  player_id: number;
  display_name: string;
  country: string | null;
  character: string | null;
}

/**
 * "Next Gen Race": el subconjunto de la Race (`kind = 'race'`, semana más reciente —
 * igual que la Race normal, sin histórico, ver docs/decisiones.md) formado por
 * jugadores que no tienen NINGÚN partido registrado en una edición de un año anterior
 * al que cubre esa Race. No es un baremo propio (CLAUDE.md §4): son los MISMOS puntos
 * de Race ya importados de Mana Games, solo filtrados y renumerados 1..N sobre el
 * subconjunto — el filtro en sí (debutante o no) sale de `matches`/`editions`, datos
 * ya importados, no inventados.
 *
 * `moved` no tiene sentido aquí (no existe un histórico de Next Gen Race contra el que
 * comparar la semana anterior) y se manda siempre en 0, que `MovedIndicator` ya pinta
 * como "--" en vez de una cifra inventada.
 */
export async function getNextGenRaceRanking(limit: number): Promise<RankedPlayer[]> {
  const week = await getLatestRaceWeek();
  if (!week) return [];

  const result = await db.execute(sql`
    SELECT rs.rank, rs.points, p.id AS player_id, p.display_name, COALESCE(p.country_override, p.country) AS country, p.character
    FROM ranking_snapshots rs
    JOIN players p ON p.id = rs.player_id
    WHERE rs.kind = 'race' AND rs.iso_year = ${week.isoYear} AND rs.iso_week = ${week.isoWeek}
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        JOIN editions e ON e.id = m.edition_id
        WHERE (m.player1_id = p.id OR m.player2_id = p.id) AND e.year < ${week.isoYear}
      )
    ORDER BY rs.rank ASC
    LIMIT ${limit}
  `);

  return rowsOf<NextGenRow>(result).map((r, i) => ({
    rank: i + 1,
    points: Number(r.points),
    moved: 0,
    playerId: Number(r.player_id),
    displayName: r.display_name,
    country: r.country,
    character: r.character,
  }));
}

interface RecentTournamentRow {
  edition_id: number;
  external_id: string;
  event_name: string;
  year: number;
  iso_week: number | null;
  surface: string;
  category: string;
  champion_id: number | null;
  champion_name: string | null;
  champion_country: string | null;
  runner_up_name: string | null;
  runner_up_country: string | null;
  final_score: string | null;
  has_draw: boolean;
}

function statusOf(r: RecentTournamentRow): TournamentStatus {
  if (r.champion_name !== null) return "completed";
  return r.has_draw ? "ongoing" : "registration";
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/**
 * Ediciones más recientes con su campeón (el ganador de la ronda 'F'). Un torneo sin
 * final registrada sale igualmente, con el campeón a null: el archivo tiene cuadros
 * incompletos y preferimos enseñarlos a esconderlos.
 */
export async function getRecentTournaments(limit: number): Promise<TournamentCardData[]> {
  const result = await db.execute(sql`
    SELECT
      e.id            AS edition_id,
      e.external_id,
      ev.display_name AS event_name,
      e.year,
      e.iso_week,
      e.surface,
      e.category,
      p.id            AS champion_id,
      p.display_name  AS champion_name,
      COALESCE(p.country_override, p.country) AS champion_country,
      ru.display_name AS runner_up_name,
      COALESCE(ru.country_override, ru.country) AS runner_up_country,
      m.score_raw     AS final_score,
      (
        EXISTS(SELECT 1 FROM matches mm WHERE mm.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes by2 WHERE by2.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)
      ) AS has_draw
    FROM editions e
    JOIN events ev ON ev.id = e.event_id
    LEFT JOIN matches m ON m.edition_id = e.id AND m.round = 'F'
    LEFT JOIN players p ON p.id = m.winner_id
    LEFT JOIN players ru ON ru.id = (CASE WHEN m.winner_id = m.player1_id THEN m.player2_id ELSE m.player1_id END)
    -- Las Finals ya salen por su propia sección ("Season Finale", app/tournaments/page.tsx,
    -- vía listFinalsEditions) — sin este filtro, su edición espejada
    -- (lib/finals/mirror.ts) saldría aquí TAMBIÉN, con un estado derivado equivocado
    -- (sin partidos decididos = "Registration Open", que las Finals nunca son).
    WHERE e.source_id IN (SELECT id FROM sources WHERE slug = 'mana')
    ORDER BY e.year DESC, e.iso_week DESC NULLS LAST, e.id DESC
    LIMIT ${limit}
  `);

  return rowsOf<RecentTournamentRow>(result).map((r) => ({
    editionId: Number(r.edition_id),
    externalId: r.external_id,
    eventName: r.event_name,
    year: Number(r.year),
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    surface: r.surface,
    category: r.category,
    championId: r.champion_id === null ? null : Number(r.champion_id),
    championName: r.champion_name,
    championCountry: r.champion_country,
    runnerUpName: r.runner_up_name,
    runnerUpCountry: r.runner_up_country,
    finalScore: r.final_score,
    status: statusOf(r),
  }));
}

/** Ediciones de una temporada, para el índice de torneos. */
export async function getTournamentsByYear(year: number): Promise<TournamentCardData[]> {
  const result = await db.execute(sql`
    SELECT
      e.id            AS edition_id,
      e.external_id,
      ev.display_name AS event_name,
      e.year,
      e.iso_week,
      e.surface,
      e.category,
      p.id            AS champion_id,
      p.display_name  AS champion_name,
      COALESCE(p.country_override, p.country) AS champion_country,
      ru.display_name AS runner_up_name,
      COALESCE(ru.country_override, ru.country) AS runner_up_country,
      m.score_raw     AS final_score,
      (
        EXISTS(SELECT 1 FROM matches mm WHERE mm.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes by2 WHERE by2.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)
      ) AS has_draw
    FROM editions e
    JOIN events ev ON ev.id = e.event_id
    LEFT JOIN matches m ON m.edition_id = e.id AND m.round = 'F'
    LEFT JOIN players p ON p.id = m.winner_id
    LEFT JOIN players ru ON ru.id = (CASE WHEN m.winner_id = m.player1_id THEN m.player2_id ELSE m.player1_id END)
    -- Mismo motivo que en getRecentTournaments: las Finals se enseñan aparte.
    WHERE e.year = ${year} AND e.source_id IN (SELECT id FROM sources WHERE slug = 'mana')
    ORDER BY e.iso_week DESC NULLS LAST, e.id DESC
  `);

  return rowsOf<RecentTournamentRow>(result).map((r) => ({
    editionId: Number(r.edition_id),
    externalId: r.external_id,
    eventName: r.event_name,
    year: Number(r.year),
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    surface: r.surface,
    category: r.category,
    championId: r.champion_id === null ? null : Number(r.champion_id),
    championName: r.champion_name,
    championCountry: r.champion_country,
    runnerUpName: r.runner_up_name,
    runnerUpCountry: r.runner_up_country,
    finalScore: r.final_score,
    status: statusOf(r),
  }));
}

export async function getSeasons(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: editions.year })
    .from(editions)
    .orderBy(desc(editions.year));
  return rows.map((r) => r.year);
}

/** Número de ediciones distintas en las que ha aparecido cada jugador. */
export async function getTournamentCounts(): Promise<Map<number, number>> {
  const result = await db.execute(sql`
    SELECT player_id, count(DISTINCT edition_id)::int AS tournaments
    FROM (
      SELECT player1_id AS player_id, edition_id FROM matches
      UNION ALL
      SELECT player2_id AS player_id, edition_id FROM matches
    ) t
    WHERE player_id IS NOT NULL
    GROUP BY player_id
  `);
  return new Map(
    rowsOf<{ player_id: number; tournaments: number }>(result).map((r) => [
      Number(r.player_id),
      Number(r.tournaments),
    ]),
  );
}

export interface PlayerTotals {
  wins: number;
  losses: number;
  titles: number;
  careerHigh: number | null;
}

/** Balance, títulos y mejor ranking de todos los jugadores de una tacada.
 *
 * Un w.o. no cuenta como derrota para quien no pudo jugar, ni como victoria para
 * quien pasa de ronda (pedido explícito del propietario, 2026-08-16) — un bye ya no
 * contaba como victoria de nadie porque ni siquiera existe como fila en `matches`
 * (nunca se archivó, ver docs/estructura.md §3), así que ese lado ya estaba cubierto
 * solo. */
export async function getPlayerTotals(): Promise<Map<number, PlayerTotals>> {
  const result = await db.execute(sql`
    WITH played AS (
      SELECT player1_id AS player_id, winner_id, round, outcome FROM matches WHERE player1_id IS NOT NULL
      UNION ALL
      SELECT player2_id AS player_id, winner_id, round, outcome FROM matches WHERE player2_id IS NOT NULL
    ),
    totals AS (
      SELECT
        player_id,
        count(*) FILTER (WHERE winner_id = player_id AND outcome <> 'walkover')::int  AS wins,
        count(*) FILTER (WHERE winner_id <> player_id AND outcome <> 'walkover')::int AS losses,
        count(*) FILTER (WHERE winner_id = player_id AND round = 'F')::int AS titles
      FROM played
      GROUP BY player_id
    ),
    highs AS (
      SELECT player_id, min(rank)::int AS career_high
      FROM ranking_snapshots
      WHERE kind = 'official'
      GROUP BY player_id
    )
    SELECT
      COALESCE(t.player_id, h.player_id) AS player_id,
      COALESCE(t.wins, 0)   AS wins,
      COALESCE(t.losses, 0) AS losses,
      COALESCE(t.titles, 0) AS titles,
      h.career_high
    FROM totals t
    FULL OUTER JOIN highs h ON h.player_id = t.player_id
  `);

  return new Map(
    rowsOf<{
      player_id: number;
      wins: number;
      losses: number;
      titles: number;
      career_high: number | null;
    }>(result).map((r) => [
      Number(r.player_id),
      {
        wins: Number(r.wins),
        losses: Number(r.losses),
        titles: Number(r.titles),
        careerHigh: r.career_high === null ? null : Number(r.career_high),
      },
    ]),
  );
}

/** Balance del año en curso del tour, por jugador — mismo criterio de w.o. que
 * `getPlayerTotals`. */
export async function getYearRecords(year: number): Promise<Map<number, { wins: number; losses: number; titles: number }>> {
  const result = await db.execute(sql`
    WITH played AS (
      SELECT m.player1_id AS player_id, m.winner_id, m.round, m.outcome FROM matches m
        JOIN editions e ON e.id = m.edition_id WHERE e.year = ${year} AND m.player1_id IS NOT NULL
      UNION ALL
      SELECT m.player2_id AS player_id, m.winner_id, m.round, m.outcome FROM matches m
        JOIN editions e ON e.id = m.edition_id WHERE e.year = ${year} AND m.player2_id IS NOT NULL
    )
    SELECT
      player_id,
      count(*) FILTER (WHERE winner_id = player_id AND outcome <> 'walkover')::int  AS wins,
      count(*) FILTER (WHERE winner_id <> player_id AND outcome <> 'walkover')::int AS losses,
      count(*) FILTER (WHERE winner_id = player_id AND round = 'F')::int AS titles
    FROM played
    GROUP BY player_id
  `);
  return new Map(
    rowsOf<{ player_id: number; wins: number; losses: number; titles: number }>(result).map((r) => [
      Number(r.player_id),
      { wins: Number(r.wins), losses: Number(r.losses), titles: Number(r.titles) },
    ]),
  );
}
