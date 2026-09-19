import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, matches, rankingSnapshots } from "@/db/schema";
import { getLatestRankingWeek } from "@/lib/tourQueries";
import { getH2HMeetings, getCareerStats } from "@/lib/h2hStats";
import { computeWinProbability, type PreMatchFactors, type WinProbability } from "./preMatchModel";

/** Últimos partidos a mirar para la "forma reciente" de cada jugador — mismo criterio
 * que el "form" que ya se usa informalmente en tenis real (últimos 10). */
const RECENT_FORM_MATCHES = 10;
/** Amortigua un H2H de muestra pequeña: un 1-0 no debe pesar como un 10-0. */
const H2H_DAMPENING_K = 3;
/** Divide la diferencia de puntos de ranking antes de `tanh` — puntos típicos del tour
 * van de unos pocos cientos a varios miles, este valor mantiene diferencias normales
 * dentro del tramo sensible de `tanh` sin saturar de inmediato a ±1. */
const RANKING_POINTS_NORMALIZER = 2000;

async function getRecentWinPct(playerId: number): Promise<number | null> {
  const rows = await db
    .select({ winnerId: matches.winnerId })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .where(and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)), eq(matches.outcome, "played")))
    .orderBy(desc(editions.year), desc(editions.isoWeek), desc(matches.id))
    .limit(RECENT_FORM_MATCHES);

  if (rows.length === 0) return null;
  const wins = rows.filter((r) => r.winnerId === playerId).length;
  return wins / rows.length;
}

async function getRankingPoints(playerId: number, week: { isoYear: number; isoWeek: number } | null): Promise<number | null> {
  if (!week) return null;
  const [row] = await db
    .select({ points: rankingSnapshots.points })
    .from(rankingSnapshots)
    .where(and(eq(rankingSnapshots.playerId, playerId), eq(rankingSnapshots.kind, "official"), eq(rankingSnapshots.isoYear, week.isoYear), eq(rankingSnapshots.isoWeek, week.isoWeek)))
    .limit(1);
  return row?.points ?? null;
}

export async function getPreMatchFactors(player1Id: number, player2Id: number): Promise<PreMatchFactors> {
  const currentYear = new Date().getFullYear();
  const latestWeek = await getLatestRankingWeek();

  const [points1, points2, meetings, recentForm1, recentForm2, career1, career2] = await Promise.all([
    getRankingPoints(player1Id, latestWeek),
    getRankingPoints(player2Id, latestWeek),
    getH2HMeetings(player1Id, player2Id),
    getRecentWinPct(player1Id),
    getRecentWinPct(player2Id),
    getCareerStats(player1Id, currentYear),
    getCareerStats(player2Id, currentYear),
  ]);

  const rankingGapScore = points1 !== null && points2 !== null ? Math.tanh((points1 - points2) / RANKING_POINTS_NORMALIZER) : 0;

  const decisiveMeetings = meetings.filter((m) => m.outcome !== "walkover");
  const h2hWins1 = decisiveMeetings.filter((m) => m.winnerId === player1Id).length;
  const h2hWins2 = decisiveMeetings.filter((m) => m.winnerId === player2Id).length;
  const h2hScore = decisiveMeetings.length > 0 ? Math.tanh((h2hWins1 - h2hWins2) / (decisiveMeetings.length + H2H_DAMPENING_K)) : 0;

  const recentFormScore = recentForm1 !== null && recentForm2 !== null ? Math.tanh(recentForm1 - recentForm2) : 0;

  const total1 = career1.careerWins + career1.careerLosses;
  const total2 = career2.careerWins + career2.careerLosses;
  const winPct1 = total1 > 0 ? career1.careerWins / total1 : null;
  const winPct2 = total2 > 0 ? career2.careerWins / total2 : null;
  const surfaceScore = winPct1 !== null && winPct2 !== null ? Math.tanh(winPct1 - winPct2) : 0;

  return { rankingGapScore, h2hScore, recentFormScore, surfaceScore };
}

export async function getPreMatchWinProbability(player1Id: number, player2Id: number): Promise<WinProbability> {
  const factors = await getPreMatchFactors(player1Id, player2Id);
  return computeWinProbability(factors);
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

function normalizedPairKey(a: number, b: number): string {
  return `${Math.min(a, b)}:${Math.max(a, b)}`;
}

/** Clave del `Map` que devuelve `getPreMatchWinProbabilitiesForPairs` — respeta el
 * orden exacto (player1Id, player2Id) que pidió el llamador, para que `player1`/
 * `player2` en el `WinProbability` devuelto signifiquen lo mismo que en la entrada
 * (nunca normalizada: dos partidos distintos pueden pedir el mismo par en órdenes
 * distintos, y cada uno espera SU orden de vuelta). */
export function preMatchPairKey(player1Id: number, player2Id: number): string {
  return `${player1Id}:${player2Id}`;
}

/**
 * Igual que `getPreMatchWinProbability`, pero para TODOS los cruces pendientes de una
 * página a la vez (un cuadro de torneo) en un puñado de consultas en vez de una por
 * cruce — bug real, corregido 2026-09-17: un cuadro con 16 cruces pendientes emparejados
 * hacía ~7 consultas por cruce (unas 112 en total) solo para el Win% previo. Aquí son 4
 * consultas SIEMPRE, sin importar cuántos cruces traiga `pairs`.
 */
export async function getPreMatchWinProbabilitiesForPairs(pairs: { player1Id: number; player2Id: number }[]): Promise<Map<string, WinProbability>> {
  if (pairs.length === 0) return new Map();

  const playerIds = [...new Set(pairs.flatMap((p) => [p.player1Id, p.player2Id]))];
  const latestWeek = await getLatestRankingWeek();

  const [pointsRows, formResult, careerResult, h2hRows] = await Promise.all([
    latestWeek
      ? db
          .select({ playerId: rankingSnapshots.playerId, points: rankingSnapshots.points })
          .from(rankingSnapshots)
          .where(
            and(
              inArray(rankingSnapshots.playerId, playerIds),
              eq(rankingSnapshots.kind, "official"),
              eq(rankingSnapshots.isoYear, latestWeek.isoYear),
              eq(rankingSnapshots.isoWeek, latestWeek.isoWeek),
            ),
          )
      : Promise.resolve([]),
    // "Forma reciente" de cada jugador a la vez: últimos RECENT_FORM_MATCHES de cada
    // uno, vía número de fila particionado por jugador — una sola consulta en vez de
    // una por jugador (`getRecentWinPct` original).
    db.execute(sql`
      WITH per_player AS (
        SELECT m.id, m.winner_id, e.year, e.iso_week, m.player1_id AS player_id
        FROM matches m JOIN editions e ON e.id = m.edition_id
        WHERE m.outcome = 'played' AND m.player1_id IN ${playerIds}
        UNION ALL
        SELECT m.id, m.winner_id, e.year, e.iso_week, m.player2_id AS player_id
        FROM matches m JOIN editions e ON e.id = m.edition_id
        WHERE m.outcome = 'played' AND m.player2_id IN ${playerIds}
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY player_id ORDER BY year DESC, iso_week DESC NULLS LAST, id DESC) AS rn
        FROM per_player
      )
      SELECT player_id, count(*)::int AS total, count(*) FILTER (WHERE winner_id = player_id)::int AS wins
      FROM ranked WHERE rn <= ${RECENT_FORM_MATCHES} GROUP BY player_id
    `),
    // Récord de carrera (todo, sin límite) de cada jugador a la vez — mismo criterio de
    // w.o. que getCareerStats (nunca cuenta como victoria ni derrota de nadie).
    db.execute(sql`
      WITH per_player AS (
        SELECT winner_id, outcome, player1_id AS player_id FROM matches WHERE player1_id IN ${playerIds}
        UNION ALL
        SELECT winner_id, outcome, player2_id AS player_id FROM matches WHERE player2_id IN ${playerIds}
      )
      SELECT player_id,
        count(*) FILTER (WHERE winner_id = player_id AND outcome <> 'walkover')::int AS wins,
        count(*) FILTER (WHERE winner_id <> player_id AND outcome <> 'walkover')::int AS losses
      FROM per_player GROUP BY player_id
    `),
    // H2H de TODAS las parejas pedidas en una sola consulta (en vez de una por pareja).
    db
      .select({ player1Id: matches.player1Id, player2Id: matches.player2Id, winnerId: matches.winnerId, outcome: matches.outcome })
      .from(matches)
      .where(
        or(
          ...pairs.flatMap((p) => [
            and(eq(matches.player1Id, p.player1Id), eq(matches.player2Id, p.player2Id)),
            and(eq(matches.player1Id, p.player2Id), eq(matches.player2Id, p.player1Id)),
          ]),
        ),
      ),
  ]);

  const pointsByPlayer = new Map(pointsRows.map((r) => [r.playerId, r.points]));

  const formByPlayer = new Map<number, number>();
  for (const r of rowsOf<{ player_id: number; total: number; wins: number }>(formResult)) {
    const total = Number(r.total);
    if (total > 0) formByPlayer.set(Number(r.player_id), Number(r.wins) / total);
  }

  const careerByPlayer = new Map<number, { wins: number; losses: number }>();
  for (const r of rowsOf<{ player_id: number; wins: number; losses: number }>(careerResult)) {
    careerByPlayer.set(Number(r.player_id), { wins: Number(r.wins), losses: Number(r.losses) });
  }

  const h2hByPair = new Map<string, { winnerId: number | null; outcome: string }[]>();
  for (const row of h2hRows) {
    if (row.player1Id === null || row.player2Id === null) continue;
    const key = normalizedPairKey(row.player1Id, row.player2Id);
    const list = h2hByPair.get(key) ?? [];
    list.push({ winnerId: row.winnerId, outcome: row.outcome });
    h2hByPair.set(key, list);
  }

  const result = new Map<string, WinProbability>();
  for (const { player1Id, player2Id } of pairs) {
    const points1 = pointsByPlayer.get(player1Id) ?? null;
    const points2 = pointsByPlayer.get(player2Id) ?? null;
    const rankingGapScore = points1 !== null && points2 !== null ? Math.tanh((points1 - points2) / RANKING_POINTS_NORMALIZER) : 0;

    const meetings = (h2hByPair.get(normalizedPairKey(player1Id, player2Id)) ?? []).filter((m) => m.outcome !== "walkover");
    const h2hWins1 = meetings.filter((m) => m.winnerId === player1Id).length;
    const h2hWins2 = meetings.filter((m) => m.winnerId === player2Id).length;
    const h2hScore = meetings.length > 0 ? Math.tanh((h2hWins1 - h2hWins2) / (meetings.length + H2H_DAMPENING_K)) : 0;

    const form1 = formByPlayer.get(player1Id);
    const form2 = formByPlayer.get(player2Id);
    const recentFormScore = form1 !== undefined && form2 !== undefined ? Math.tanh(form1 - form2) : 0;

    const career1 = careerByPlayer.get(player1Id);
    const career2 = careerByPlayer.get(player2Id);
    const total1 = career1 ? career1.wins + career1.losses : 0;
    const total2 = career2 ? career2.wins + career2.losses : 0;
    const winPct1 = career1 && total1 > 0 ? career1.wins / total1 : null;
    const winPct2 = career2 && total2 > 0 ? career2.wins / total2 : null;
    const surfaceScore = winPct1 !== null && winPct2 !== null ? Math.tanh(winPct1 - winPct2) : 0;

    result.set(preMatchPairKey(player1Id, player2Id), computeWinProbability({ rankingGapScore, h2hScore, recentFormScore, surfaceScore }));
  }
  return result;
}
