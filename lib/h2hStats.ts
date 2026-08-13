import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, players, rankingSnapshots } from "@/db/schema";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

export interface H2HMeeting {
  matchId: number;
  editionId: number;
  year: number;
  isoWeek: number | null;
  eventName: string;
  surface: string;
  category: string;
  round: string;
  winnerId: number;
  winnerName: string;
  loserName: string;
  scoreRaw: string | null;
  outcome: string;
}

/** Todos los cruces entre dos jugadores, del más reciente al más antiguo. */
export async function getH2HMeetings(
  player1Id: number,
  player2Id: number,
): Promise<H2HMeeting[]> {
  const pA = alias(players, "pA");
  const pB = alias(players, "pB");

  const rows = await db
    .select({
      matchId: matches.id,
      editionId: matches.editionId,
      round: matches.round,
      scoreRaw: matches.scoreRaw,
      outcome: matches.outcome,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player1Name: pA.displayName,
      player2Name: pB.displayName,
      year: editions.year,
      isoWeek: editions.isoWeek,
      surface: editions.surface,
      category: editions.category,
      eventName: events.displayName,
    })
    .from(matches)
    .innerJoin(editions, eq(matches.editionId, editions.id))
    .innerJoin(events, eq(editions.eventId, events.id))
    .innerJoin(pA, eq(pA.id, matches.player1Id))
    .innerJoin(pB, eq(pB.id, matches.player2Id))
    .where(
      or(
        and(eq(matches.player1Id, player1Id), eq(matches.player2Id, player2Id)),
        and(eq(matches.player1Id, player2Id), eq(matches.player2Id, player1Id)),
      ),
    )
    .orderBy(desc(editions.year), desc(editions.isoWeek));

  return rows.map((m) => ({
    matchId: m.matchId,
    editionId: m.editionId,
    year: m.year,
    isoWeek: m.isoWeek,
    eventName: m.eventName,
    surface: m.surface,
    category: m.category,
    round: m.round,
    winnerId: m.winnerId!,
    winnerName: m.winnerId === m.player1Id ? m.player1Name : m.player2Name,
    loserName: m.winnerId === m.player1Id ? m.player2Name : m.player1Name,
    scoreRaw: m.scoreRaw,
    outcome: m.outcome,
  }));
}

export interface SplitRow {
  label: string;
  player1Wins: number;
  player2Wins: number;
}

export interface H2HBreakdown {
  /** Sets y juegos solo de los cruces entre ambos. */
  player1Sets: number;
  player2Sets: number;
  player1Games: number;
  player2Games: number;
  player1Tiebreaks: number;
  player2Tiebreaks: number;
  bySurface: SplitRow[];
  byCategory: SplitRow[];
  byRound: SplitRow[];
  /** Por temporada, de la más antigua a la más reciente — es lo que deja ver si la
   * tendencia del enfrentamiento se ha dado la vuelta en algún momento. */
  byYear: SplitRow[];
  /** Racha viva del enfrentamiento: quién ha ganado los últimos N seguidos. */
  streakPlayerId: number | null;
  streakCount: number;
}

interface SetAggRow {
  winner_id: number;
  sets_won_by_winner: number;
  sets_won_by_loser: number;
  games_winner: number;
  games_loser: number;
  tb_winner: number;
  tb_loser: number;
}

/**
 * Desglose del enfrentamiento. `sets.winner_games` son los juegos del ganador **del
 * partido** en ese set (no del set), así que un set perdido por el ganador del partido
 * tiene winner_games < loser_games — de ahí las comparaciones.
 */
export async function getH2HBreakdown(
  player1Id: number,
  player2Id: number,
  meetings: H2HMeeting[],
): Promise<H2HBreakdown> {
  const empty: H2HBreakdown = {
    player1Sets: 0,
    player2Sets: 0,
    player1Games: 0,
    player2Games: 0,
    player1Tiebreaks: 0,
    player2Tiebreaks: 0,
    bySurface: [],
    byCategory: [],
    byRound: [],
    byYear: [],
    streakPlayerId: null,
    streakCount: 0,
  };
  if (meetings.length === 0) return empty;

  const result = await db.execute(sql`
    SELECT
      m.winner_id,
      count(*) FILTER (WHERE s.winner_games > s.loser_games)::int AS sets_won_by_winner,
      count(*) FILTER (WHERE s.winner_games < s.loser_games)::int AS sets_won_by_loser,
      COALESCE(sum(s.winner_games), 0)::int AS games_winner,
      COALESCE(sum(s.loser_games), 0)::int  AS games_loser,
      count(*) FILTER (WHERE s.tiebreak_loser_points IS NOT NULL AND s.winner_games > s.loser_games)::int AS tb_winner,
      count(*) FILTER (WHERE s.tiebreak_loser_points IS NOT NULL AND s.winner_games < s.loser_games)::int AS tb_loser
    FROM matches m
    JOIN sets s ON s.match_id = m.id
    WHERE (m.player1_id = ${player1Id} AND m.player2_id = ${player2Id})
       OR (m.player1_id = ${player2Id} AND m.player2_id = ${player1Id})
    GROUP BY m.winner_id
  `);

  const agg = { ...empty };
  for (const r of rowsOf<SetAggRow>(result)) {
    const winnerIsP1 = Number(r.winner_id) === player1Id;
    const setsW = Number(r.sets_won_by_winner);
    const setsL = Number(r.sets_won_by_loser);
    const gamesW = Number(r.games_winner);
    const gamesL = Number(r.games_loser);
    const tbW = Number(r.tb_winner);
    const tbL = Number(r.tb_loser);

    agg.player1Sets += winnerIsP1 ? setsW : setsL;
    agg.player2Sets += winnerIsP1 ? setsL : setsW;
    agg.player1Games += winnerIsP1 ? gamesW : gamesL;
    agg.player2Games += winnerIsP1 ? gamesL : gamesW;
    agg.player1Tiebreaks += winnerIsP1 ? tbW : tbL;
    agg.player2Tiebreaks += winnerIsP1 ? tbL : tbW;
  }

  const split = (key: (m: H2HMeeting) => string): SplitRow[] => {
    const map = new Map<string, SplitRow>();
    for (const m of meetings) {
      const label = key(m);
      const row = map.get(label) ?? { label, player1Wins: 0, player2Wins: 0 };
      if (m.winnerId === player1Id) row.player1Wins++;
      else row.player2Wins++;
      map.set(label, row);
    }
    return [...map.values()].sort(
      (a, b) => b.player1Wins + b.player2Wins - (a.player1Wins + a.player2Wins),
    );
  };

  // `meetings` viene del más reciente al más antiguo, así que la racha se cuenta desde
  // el principio de la lista.
  const streakPlayerId = meetings[0].winnerId;
  let streakCount = 0;
  for (const m of meetings) {
    if (m.winnerId !== streakPlayerId) break;
    streakCount++;
  }

  return {
    ...agg,
    bySurface: split((m) => m.surface),
    byCategory: split((m) => m.category),
    byRound: split((m) => m.round),
    byYear: split((m) => String(m.year)).sort((a, b) => Number(a.label) - Number(b.label)),
    streakPlayerId,
    streakCount,
  };
}

export interface CareerStats {
  careerWins: number;
  careerLosses: number;
  careerTitles: number;
  careerFinals: number;
  yearWins: number;
  yearLosses: number;
  yearTitles: number;
  winPct: number;
  careerHigh: number | null;
  weeksTop10: number;
  currentPoints: number | null;
  currentRank: number | null;
  tournamentsPlayed: number;
  firstSeenYear: number | null;
}

interface CareerRow {
  career_wins: number;
  career_losses: number;
  career_titles: number;
  career_finals: number;
  year_wins: number;
  year_losses: number;
  year_titles: number;
  tournaments_played: number;
}

/** Comparativa de carrera de un jugador. Todo sale de partidos y snapshots ya
 * importados: son agregados, no un baremo alternativo (CLAUDE.md §4). */
export async function getCareerStats(
  playerId: number,
  currentYear: number,
): Promise<CareerStats> {
  const [matchResult, rankRows, highRow, top10Row, firstSeenRow] = await Promise.all([
    db.execute(sql`
      WITH played AS (
        SELECT m.id, m.winner_id, m.round, m.edition_id, e.year
        FROM matches m
        JOIN editions e ON e.id = m.edition_id
        WHERE m.player1_id = ${playerId} OR m.player2_id = ${playerId}
      )
      SELECT
        count(*) FILTER (WHERE winner_id = ${playerId})::int   AS career_wins,
        count(*) FILTER (WHERE winner_id <> ${playerId})::int  AS career_losses,
        count(*) FILTER (WHERE winner_id = ${playerId} AND round = 'F')::int AS career_titles,
        count(*) FILTER (WHERE round = 'F')::int               AS career_finals,
        count(*) FILTER (WHERE winner_id = ${playerId} AND year = ${currentYear})::int  AS year_wins,
        count(*) FILTER (WHERE winner_id <> ${playerId} AND year = ${currentYear})::int AS year_losses,
        count(*) FILTER (WHERE winner_id = ${playerId} AND round = 'F' AND year = ${currentYear})::int AS year_titles,
        count(DISTINCT edition_id)::int                        AS tournaments_played
      FROM played
    `),
    db
      .select({ rank: rankingSnapshots.rank, points: rankingSnapshots.points })
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.playerId, playerId))
      .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek))
      .limit(1),
    db
      .select({ rank: rankingSnapshots.rank })
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.playerId, playerId))
      .orderBy(rankingSnapshots.rank)
      .limit(1),
    db.execute(sql`
      SELECT count(*)::int AS weeks
      FROM ranking_snapshots
      WHERE player_id = ${playerId} AND rank <= 10
    `),
    db
      .select({ year: rankingSnapshots.isoYear })
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.playerId, playerId))
      .orderBy(rankingSnapshots.isoYear)
      .limit(1),
  ]);

  const m = rowsOf<CareerRow>(matchResult)[0];
  const careerWins = Number(m?.career_wins ?? 0);
  const careerLosses = Number(m?.career_losses ?? 0);
  const total = careerWins + careerLosses;

  return {
    careerWins,
    careerLosses,
    careerTitles: Number(m?.career_titles ?? 0),
    careerFinals: Number(m?.career_finals ?? 0),
    yearWins: Number(m?.year_wins ?? 0),
    yearLosses: Number(m?.year_losses ?? 0),
    yearTitles: Number(m?.year_titles ?? 0),
    winPct: total > 0 ? Math.round((careerWins / total) * 100) : 0,
    careerHigh: highRow[0]?.rank ?? null,
    weeksTop10: Number(rowsOf<{ weeks: number }>(top10Row)[0]?.weeks ?? 0),
    currentPoints: rankRows[0]?.points ?? null,
    currentRank: rankRows[0]?.rank ?? null,
    tournamentsPlayed: Number(m?.tournaments_played ?? 0),
    firstSeenYear: firstSeenRow[0]?.year ?? null,
  };
}
