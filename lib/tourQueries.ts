import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, events, matches, players, rankingSnapshots } from "@/db/schema";
import type { TournamentCardData } from "@/components/tournaments/TournamentCard";

export interface IsoWeekRef {
  isoYear: number;
  isoWeek: number;
}

/** Última semana de ranking importada. Es el "ahora" del tour para toda la web. */
export async function getLatestRankingWeek(): Promise<IsoWeekRef | null> {
  const [row] = await db
    .select({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
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
      country: players.country,
      character: players.character,
    })
    .from(rankingSnapshots)
    .innerJoin(players, eq(players.id, rankingSnapshots.playerId))
    .where(
      and(
        eq(rankingSnapshots.isoYear, week.isoYear),
        eq(rankingSnapshots.isoWeek, week.isoWeek),
      ),
    )
    .orderBy(rankingSnapshots.rank)
    .limit(limit);
}

interface RecentTournamentRow {
  edition_id: number;
  event_name: string;
  year: number;
  iso_week: number | null;
  surface: string;
  category: string;
  draw_size: number;
  champion_id: number | null;
  champion_name: string | null;
  champion_country: string | null;
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
      ev.display_name AS event_name,
      e.year,
      e.iso_week,
      e.surface,
      e.category,
      e.draw_size,
      p.id            AS champion_id,
      p.display_name  AS champion_name,
      p.country       AS champion_country
    FROM editions e
    JOIN events ev ON ev.id = e.event_id
    LEFT JOIN matches m ON m.edition_id = e.id AND m.round = 'F'
    LEFT JOIN players p ON p.id = m.winner_id
    ORDER BY e.year DESC, e.iso_week DESC NULLS LAST, e.id DESC
    LIMIT ${limit}
  `);

  return rowsOf<RecentTournamentRow>(result).map((r) => ({
    editionId: Number(r.edition_id),
    eventName: r.event_name,
    year: Number(r.year),
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    surface: r.surface,
    category: r.category,
    drawSize: Number(r.draw_size),
    championId: r.champion_id === null ? null : Number(r.champion_id),
    championName: r.champion_name,
    championCountry: r.champion_country,
  }));
}

/** Ediciones de una temporada, para el índice de torneos. */
export async function getTournamentsByYear(year: number): Promise<TournamentCardData[]> {
  const result = await db.execute(sql`
    SELECT
      e.id            AS edition_id,
      ev.display_name AS event_name,
      e.year,
      e.iso_week,
      e.surface,
      e.category,
      e.draw_size,
      p.id            AS champion_id,
      p.display_name  AS champion_name,
      p.country       AS champion_country
    FROM editions e
    JOIN events ev ON ev.id = e.event_id
    LEFT JOIN matches m ON m.edition_id = e.id AND m.round = 'F'
    LEFT JOIN players p ON p.id = m.winner_id
    WHERE e.year = ${year}
    ORDER BY e.iso_week DESC NULLS LAST, e.id DESC
  `);

  return rowsOf<RecentTournamentRow>(result).map((r) => ({
    editionId: Number(r.edition_id),
    eventName: r.event_name,
    year: Number(r.year),
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    surface: r.surface,
    category: r.category,
    drawSize: Number(r.draw_size),
    championId: r.champion_id === null ? null : Number(r.champion_id),
    championName: r.champion_name,
    championCountry: r.champion_country,
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

/** Balance, títulos y mejor ranking de todos los jugadores de una tacada. */
export async function getPlayerTotals(): Promise<Map<number, PlayerTotals>> {
  const result = await db.execute(sql`
    WITH played AS (
      SELECT player1_id AS player_id, winner_id, round FROM matches WHERE player1_id IS NOT NULL
      UNION ALL
      SELECT player2_id AS player_id, winner_id, round FROM matches WHERE player2_id IS NOT NULL
    ),
    totals AS (
      SELECT
        player_id,
        count(*) FILTER (WHERE winner_id = player_id)::int  AS wins,
        count(*) FILTER (WHERE winner_id <> player_id)::int AS losses,
        count(*) FILTER (WHERE winner_id = player_id AND round = 'F')::int AS titles
      FROM played
      GROUP BY player_id
    ),
    highs AS (
      SELECT player_id, min(rank)::int AS career_high
      FROM ranking_snapshots
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

/** Balance del año en curso del tour, por jugador. */
export async function getYearRecords(year: number): Promise<Map<number, { wins: number; losses: number }>> {
  const result = await db.execute(sql`
    WITH played AS (
      SELECT m.player1_id AS player_id, m.winner_id FROM matches m
        JOIN editions e ON e.id = m.edition_id WHERE e.year = ${year} AND m.player1_id IS NOT NULL
      UNION ALL
      SELECT m.player2_id AS player_id, m.winner_id FROM matches m
        JOIN editions e ON e.id = m.edition_id WHERE e.year = ${year} AND m.player2_id IS NOT NULL
    )
    SELECT
      player_id,
      count(*) FILTER (WHERE winner_id = player_id)::int  AS wins,
      count(*) FILTER (WHERE winner_id <> player_id)::int AS losses
    FROM played
    GROUP BY player_id
  `);
  return new Map(
    rowsOf<{ player_id: number; wins: number; losses: number }>(result).map((r) => [
      Number(r.player_id),
      { wins: Number(r.wins), losses: Number(r.losses) },
    ]),
  );
}
