import { sql } from "drizzle-orm";
import { db } from "@/db/client";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/** Los códigos de ronda ('F', 'S', 'Q1'...) se leen fatal en prosa generada — mismo
 * problema y mismo arreglo que lib/h2hNarrative.ts::roundInProse. */
const ROUND_IN_PROSE: Record<string, string> = {
  F: "the final",
  S: "the semi-finals",
  Q: "the quarter-finals",
};

function roundInProse(round: string): string {
  if (ROUND_IN_PROSE[round]) return ROUND_IN_PROSE[round];
  if (round.startsWith("Q")) return "qualifying";
  return "an early round";
}

/** Umbral por debajo del cual una racha no es noticia — cualquiera gana 3 seguidos. */
const WIN_STREAK_THRESHOLD = 5;
/** Puestos de diferencia en el ranking oficial de esa semana para llamarlo sorpresa. */
const UPSET_RANK_GAP = 30;
/** Historial máximo por jugador al calcular una racha — de sobra para cortar en la
 * primera derrota sin traer la carrera entera de vuelta. */
const STREAK_LOOKBACK = 40;

/**
 * Todo detector recibe la misma fecha de corte: "genera solo lo que sea nuevo desde
 * aquí". `matches.played_at` no está relleno en el backfill histórico (ver
 * db/schema.ts) — se usa cuando existe (partidos recientes y todo lo que viene de
 * Finals, que sí lo rellena) y si no, la fecha de la semana del torneo.
 */
const RECENCY_SQL = (sinceDate: Date) => sql`
  (
    (m.played_at IS NOT NULL AND m.played_at >= ${sinceDate})
    OR (m.played_at IS NULL AND e.week_start_date IS NOT NULL AND e.week_start_date >= ${sinceDate})
  )
`;

export interface ChampionCandidate {
  kind: "champion_crowned";
  autoKey: string;
  editionId: number;
  eventName: string;
  category: string;
  year: number;
  isoWeek: number | null;
  championId: number;
  championName: string;
  runnerUpId: number;
  runnerUpName: string;
  finalScore: string | null;
}

interface ChampionRow {
  edition_id: number;
  event_name: string;
  category: string;
  year: number;
  iso_week: number | null;
  champion_id: number;
  champion_name: string;
  runner_up_id: number;
  runner_up_name: string;
  final_score: string | null;
}

/** Toda final decidida desde `sinceDate` — cuadros normales del tour y Finals (ya
 * espejadas en `matches` por lib/finals/mirror.ts, así que salen por el mismo camino
 * sin ningún caso especial aquí). */
export async function detectChampions(sinceDate: Date): Promise<ChampionCandidate[]> {
  const result = await db.execute(sql`
    SELECT
      e.id AS edition_id,
      ev.display_name AS event_name,
      e.category,
      e.year,
      e.iso_week,
      ch.id AS champion_id,
      ch.display_name AS champion_name,
      ru.id AS runner_up_id,
      ru.display_name AS runner_up_name,
      m.score_raw AS final_score
    FROM matches m
    JOIN editions e ON e.id = m.edition_id
    JOIN events ev ON ev.id = e.event_id
    JOIN players ch ON ch.id = m.winner_id
    JOIN players ru ON ru.id = (CASE WHEN m.winner_id = m.player1_id THEN m.player2_id ELSE m.player1_id END)
    WHERE m.round = 'F' AND m.winner_id IS NOT NULL AND ${RECENCY_SQL(sinceDate)}
    ORDER BY e.year DESC, e.iso_week DESC NULLS LAST, e.id DESC
  `);

  return rowsOf<ChampionRow>(result).map((r) => ({
    kind: "champion_crowned",
    autoKey: `champion-${r.edition_id}`,
    editionId: Number(r.edition_id),
    eventName: r.event_name,
    category: r.category,
    year: Number(r.year),
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    championId: Number(r.champion_id),
    championName: r.champion_name,
    runnerUpId: Number(r.runner_up_id),
    runnerUpName: r.runner_up_name,
    finalScore: r.final_score,
  }));
}

export interface TitleMilestoneCandidate {
  kind: "title_milestone";
  autoKey: string;
  editionId: number;
  eventName: string;
  year: number;
  championId: number;
  championName: string;
  runnerUpName: string;
  careerTitles: number;
  isFirstTitle: boolean;
}

/** Reutiliza los mismos campeones, pero solo se queda con el primer título de
 * alguien o una cifra redonda (5º, 10º, 15º...) — el resto ya lo cubre
 * `champion_crowned` y no aporta un ángulo distinto. */
export async function detectTitleMilestones(sinceDate: Date): Promise<TitleMilestoneCandidate[]> {
  const champions = await detectChampions(sinceDate);
  if (champions.length === 0) return [];

  const result = await db.execute(sql`
    SELECT winner_id AS player_id, count(*)::int AS titles
    FROM matches
    WHERE round = 'F' AND winner_id IN (${sql.join(champions.map((c) => sql`${c.championId}`), sql`, `)})
    GROUP BY winner_id
  `);
  const titlesByPlayer = new Map(
    rowsOf<{ player_id: number; titles: number }>(result).map((r) => [Number(r.player_id), Number(r.titles)]),
  );

  const out: TitleMilestoneCandidate[] = [];
  for (const c of champions) {
    const careerTitles = titlesByPlayer.get(c.championId) ?? 1;
    const isFirstTitle = careerTitles === 1;
    if (!isFirstTitle && careerTitles % 5 !== 0) continue;
    out.push({
      kind: "title_milestone",
      autoKey: `title-milestone-${c.championId}-${c.editionId}`,
      editionId: c.editionId,
      eventName: c.eventName,
      year: c.year,
      championId: c.championId,
      championName: c.championName,
      runnerUpName: c.runnerUpName,
      careerTitles,
      isFirstTitle,
    });
  }
  return out;
}

export interface UpsetCandidate {
  kind: "upset";
  autoKey: string;
  matchId: number;
  eventName: string;
  round: string;
  year: number;
  isoWeek: number;
  winnerId: number;
  winnerName: string;
  winnerRank: number;
  loserId: number;
  loserName: string;
  loserRank: number;
  /** Precalculado a propósito: si se le pide al modelo que mencione el hueco de
   * ranking sin dárselo ya hecho, se pone a restar por su cuenta y el resultado deja
   * de estar literalmente en los hechos — el guardrail de lib/newsGeneration/draft.ts
   * lo rechaza entero. Mismo criterio que lib/h2hNarrative.ts: toda cifra que se le
   * vaya a pedir tiene que venir ya calculada. */
  rankGap: number;
  score: string | null;
}

interface UpsetRow {
  match_id: number;
  event_name: string;
  round: string;
  year: number;
  iso_week: number;
  winner_id: number;
  winner_name: string;
  winner_rank: number;
  loser_id: number;
  loser_name: string;
  loser_rank: number;
  score_raw: string | null;
}

/** Solo entra un partido si AMBOS tenían puesto de ranking oficial esa misma semana —
 * sin eso no hay con qué medir "sorpresa", y no se inventa uno. Las Finals (sin
 * iso_week) quedan fuera por el mismo motivo. */
export async function detectUpsets(sinceDate: Date): Promise<UpsetCandidate[]> {
  const result = await db.execute(sql`
    SELECT
      m.id AS match_id,
      ev.display_name AS event_name,
      m.round,
      e.year,
      e.iso_week,
      w.id AS winner_id,
      w.display_name AS winner_name,
      wr.rank AS winner_rank,
      l.id AS loser_id,
      l.display_name AS loser_name,
      lr.rank AS loser_rank,
      m.score_raw
    FROM matches m
    JOIN editions e ON e.id = m.edition_id
    JOIN events ev ON ev.id = e.event_id
    JOIN players w ON w.id = m.winner_id
    JOIN players l ON l.id = (CASE WHEN m.winner_id = m.player1_id THEN m.player2_id ELSE m.player1_id END)
    JOIN ranking_snapshots wr ON wr.player_id = w.id AND wr.kind = 'official' AND wr.iso_year = e.year AND wr.iso_week = e.iso_week
    JOIN ranking_snapshots lr ON lr.player_id = l.id AND lr.kind = 'official' AND lr.iso_year = e.year AND lr.iso_week = e.iso_week
    WHERE m.winner_id IS NOT NULL AND e.iso_week IS NOT NULL
      AND (wr.rank - lr.rank) >= ${UPSET_RANK_GAP}
      AND ${RECENCY_SQL(sinceDate)}
    ORDER BY (wr.rank - lr.rank) DESC
    LIMIT 20
  `);

  return rowsOf<UpsetRow>(result).map((r) => {
    const winnerRank = Number(r.winner_rank);
    const loserRank = Number(r.loser_rank);
    return {
      kind: "upset",
      autoKey: `upset-${r.match_id}`,
      matchId: Number(r.match_id),
      eventName: r.event_name,
      round: roundInProse(r.round),
      year: Number(r.year),
      isoWeek: Number(r.iso_week),
      winnerId: Number(r.winner_id),
      winnerName: r.winner_name,
      winnerRank,
      loserId: Number(r.loser_id),
      loserName: r.loser_name,
      loserRank,
      rankGap: winnerRank - loserRank,
      score: r.score_raw,
    };
  });
}

export interface WinStreakCandidate {
  kind: "win_streak";
  autoKey: string;
  playerId: number;
  playerName: string;
  streakCount: number;
  /** Del más reciente al más antiguo. */
  opponentsBeaten: string[];
  mostRecentEventName: string;
  mostRecentMatchId: number;
}

interface ActivePlayerRow {
  player_id: number;
  display_name: string;
}

interface PlayerMatchRow {
  match_id: number;
  edition_id: number;
  event_name: string;
  year: number;
  iso_week: number | null;
  round: string;
  outcome: string;
  winner_id: number;
  opponent_id: number;
  opponent_name: string;
  played_at: string | Date | null;
  week_start_date: string | Date | null;
}

const ROUND_RANK_CASE = sql`
  CASE m.round
    WHEN 'RR-A' THEN -2 WHEN 'RR-B' THEN -2
    WHEN 'Q1' THEN 0 WHEN 'Q2' THEN 1 WHEN 'Q3' THEN 2
    WHEN 'R1' THEN 3 WHEN 'R2' THEN 4 WHEN 'R3' THEN 5 WHEN 'R4' THEN 6
    WHEN 'Q' THEN 7 WHEN 'S' THEN 8 WHEN 'F' THEN 9
    ELSE 999
  END
`;

/** Racha de victorias consecutivas de un jugador contra CUALQUIER rival (no un
 * head-to-head concreto) — nueva desde `sinceDate`. Los w.o. se saltan al construir la
 * secuencia (ni cuentan como victoria jugada ni la rompen), mismo criterio que
 * `lib/tourQueries.ts::getPlayerTotals`. */
export async function detectWinStreaks(sinceDate: Date): Promise<WinStreakCandidate[]> {
  const activeResult = await db.execute(sql`
    SELECT DISTINCT t.player_id, p.display_name FROM (
      SELECT m.player1_id AS player_id FROM matches m JOIN editions e ON e.id = m.edition_id WHERE m.winner_id IS NOT NULL AND ${RECENCY_SQL(sinceDate)}
      UNION
      SELECT m.player2_id AS player_id FROM matches m JOIN editions e ON e.id = m.edition_id WHERE m.winner_id IS NOT NULL AND ${RECENCY_SQL(sinceDate)}
    ) t
    JOIN players p ON p.id = t.player_id
    WHERE t.player_id IS NOT NULL
  `);
  const activePlayers = new Map<number, string>();
  for (const r of rowsOf<ActivePlayerRow>(activeResult)) activePlayers.set(Number(r.player_id), r.display_name);
  if (activePlayers.size === 0) return [];

  const out: WinStreakCandidate[] = [];
  for (const [playerId, playerName] of activePlayers) {
    const result = await db.execute(sql`
      SELECT
        m.id AS match_id,
        e.id AS edition_id,
        ev.display_name AS event_name,
        e.year,
        e.iso_week,
        m.round,
        m.outcome,
        m.winner_id,
        (CASE WHEN m.player1_id = ${playerId} THEN m.player2_id ELSE m.player1_id END) AS opponent_id,
        opp.display_name AS opponent_name,
        m.played_at,
        e.week_start_date
      FROM matches m
      JOIN editions e ON e.id = m.edition_id
      JOIN events ev ON ev.id = e.event_id
      JOIN players opp ON opp.id = (CASE WHEN m.player1_id = ${playerId} THEN m.player2_id ELSE m.player1_id END)
      WHERE (m.player1_id = ${playerId} OR m.player2_id = ${playerId})
        AND m.winner_id IS NOT NULL AND m.outcome <> 'walkover'
      ORDER BY e.year DESC, e.iso_week DESC NULLS LAST, e.id DESC, ${ROUND_RANK_CASE} DESC
      LIMIT ${STREAK_LOOKBACK}
    `);
    const rows = rowsOf<PlayerMatchRow>(result);
    if (rows.length === 0) continue;

    let streak = 0;
    for (const r of rows) {
      if (Number(r.winner_id) !== playerId) break;
      streak++;
    }
    if (streak < WIN_STREAK_THRESHOLD) continue;

    const latest = rows[0];
    const isRecent = latest.played_at !== null || latest.week_start_date !== null;
    if (!isRecent) continue;
    const latestDate = latest.played_at ? new Date(latest.played_at) : new Date(latest.week_start_date!);
    if (latestDate < sinceDate) continue;

    out.push({
      kind: "win_streak",
      autoKey: `win-streak-${playerId}-${latest.match_id}`,
      playerId,
      playerName,
      streakCount: streak,
      opponentsBeaten: rows.slice(0, streak).map((r) => r.opponent_name),
      mostRecentEventName: latest.event_name,
      mostRecentMatchId: Number(latest.match_id),
    });
  }
  return out;
}

export interface RankingMilestoneCandidate {
  kind: "ranking_milestone";
  autoKey: string;
  playerId: number;
  playerName: string;
  isoYear: number;
  isoWeek: number;
  currentRank: number;
  priorCareerHigh: number | null;
  milestone: "new_number_one" | "first_top_10" | "new_career_high";
}

interface RankRow {
  player_id: number;
  display_name: string;
  rank: number;
}

/** Solo mira la última semana oficial importada (`kind='official'`) — es la única que
 * puede ser "nueva" desde la última vez que se generaron noticias, así que no hace
 * falta una ventana de fechas aparte: la deduplicación por `autoKey` (jugador + esa
 * semana concreta) ya evita repetir la misma historia si se relanza el generador. */
export async function detectRankingMilestones(): Promise<RankingMilestoneCandidate[]> {
  const weekResult = await db.execute(sql`
    SELECT iso_year, iso_week FROM ranking_snapshots WHERE kind = 'official'
    ORDER BY iso_year DESC, iso_week DESC LIMIT 1
  `);
  const week = rowsOf<{ iso_year: number; iso_week: number }>(weekResult)[0];
  if (!week) return [];

  const currentResult = await db.execute(sql`
    SELECT rs.player_id, p.display_name, rs.rank
    FROM ranking_snapshots rs
    JOIN players p ON p.id = rs.player_id
    WHERE rs.kind = 'official' AND rs.iso_year = ${week.iso_year} AND rs.iso_week = ${week.iso_week} AND rs.rank <= 10
  `);
  const current = rowsOf<RankRow>(currentResult);
  if (current.length === 0) return [];

  const out: RankingMilestoneCandidate[] = [];
  for (const row of current) {
    const priorResult = await db.execute(sql`
      SELECT min(rank)::int AS best
      FROM ranking_snapshots
      WHERE player_id = ${row.player_id} AND kind = 'official'
        AND (iso_year < ${week.iso_year} OR (iso_year = ${week.iso_year} AND iso_week < ${week.iso_week}))
    `);
    const priorBest = rowsOf<{ best: number | null }>(priorResult)[0]?.best ?? null;
    const currentRank = Number(row.rank);

    let milestone: RankingMilestoneCandidate["milestone"] | null = null;
    if (currentRank === 1 && priorBest !== 1) milestone = "new_number_one";
    else if (currentRank <= 10 && (priorBest === null || priorBest > 10)) milestone = "first_top_10";
    else if (priorBest !== null && currentRank < priorBest) milestone = "new_career_high";
    if (!milestone) continue;

    out.push({
      kind: "ranking_milestone",
      autoKey: `ranking-milestone-${row.player_id}-${week.iso_year}-${week.iso_week}`,
      playerId: Number(row.player_id),
      playerName: row.display_name,
      isoYear: Number(week.iso_year),
      isoWeek: Number(week.iso_week),
      currentRank,
      priorCareerHigh: priorBest,
      milestone,
    });
  }
  return out;
}

export type NewsFactCandidate =
  | ChampionCandidate
  | TitleMilestoneCandidate
  | UpsetCandidate
  | WinStreakCandidate
  | RankingMilestoneCandidate;
