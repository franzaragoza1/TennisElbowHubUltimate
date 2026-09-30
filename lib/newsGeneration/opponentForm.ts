/**
 * Trae los datos reales y llama a `opponentFormTier.ts` (lógica pura, testeada aparte)
 * — para la pregunta de entrevista sobre el próximo rival (pedido explícito,
 * 2026-09-17). Misma fuente de "recencia" que lib/newsGeneration/recentForm.ts
 * (`editions.weekStartDate`, nunca `matches.playedAt`) y mismo criterio de exclusión
 * de w.o. que el resto del sitio.
 *
 * `weekStartDate` es la MISMA para todas las rondas de un mismo torneo — sola no
 * distingue un cuarto de final de la Final. Se trae de sobra (`OVERFETCH_LIMIT`, no
 * `RECENT_WINDOW`) y se reordena de verdad en JS con `compareMatchRecency` (que SÍ
 * desempata por ronda dentro del mismo torneo) antes de recortar a `RECENT_WINDOW` —
 * bug real reportado, 2026-09-30: una racha de "five-match" que en realidad tenía una
 * derrota en la Final de un torneo colada varias filas más atrás de lo que le tocaba,
 * por venir empatada en `weekStartDate` con victorias de rondas anteriores del mismo
 * torneo y salir en CUALQUIER orden entre ellas.
 */
import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, matches, sets } from "@/db/schema";
import { computeFormTier, type OpponentFormResult, type RecentMatchOutcome } from "./opponentFormTier";
import { compareMatchRecency } from "./matchChronology";

const RECENT_WINDOW = 10;
// Como mucho un torneo tiene ~7 rondas (R1..R5 + Q + S + F) empatadas en la misma
// `weekStartDate` — de sobra para que ningún grupo de empate se quede cortado a medias
// por el `LIMIT` SQL antes de poder reordenarlo bien en JS.
const OVERFETCH_LIMIT = RECENT_WINDOW + 10;

export async function getOpponentFormTier(playerId: number, beforeDate: Date): Promise<OpponentFormResult> {
  const recencyKey: SQL = sql`coalesce(${editions.weekStartDate}, make_date(${editions.year}, 12, 31))`;
  const fetched = await db
    .select({ matchId: matches.id, winnerId: matches.winnerId, round: matches.round, drawSize: editions.drawSize, recencyKey: sql<string>`${recencyKey}::text` })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .where(and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)), eq(matches.outcome, "played"), lt(recencyKey, beforeDate)))
    .orderBy(desc(recencyKey))
    .limit(OVERFETCH_LIMIT);

  const rows = [...fetched].sort(compareMatchRecency).slice(0, RECENT_WINDOW);

  const matchIds = rows.map((r) => r.matchId);
  const setRows = matchIds.length > 0 ? await db.select({ matchId: sets.matchId, winnerGames: sets.winnerGames, loserGames: sets.loserGames }).from(sets).where(sql`${sets.matchId} IN ${matchIds}`) : [];
  const setsLostByMatch = new Map<number, number>();
  for (const s of setRows) {
    // `winnerGames`/`loserGames` van en perspectiva del ganador DEL PARTIDO (ver
    // lib/h2hStats.ts::getH2HBreakdown) — un set perdido por el ganador del partido es
    // uno con winnerGames < loserGames, sin importar quién sacó en él.
    if (s.winnerGames < s.loserGames) setsLostByMatch.set(s.matchId, (setsLostByMatch.get(s.matchId) ?? 0) + 1);
  }

  const recent: RecentMatchOutcome[] = rows.map((r) => ({ won: r.winnerId === playerId, setsLost: setsLostByMatch.get(r.matchId) ?? 0 }));
  return computeFormTier(recent);
}
