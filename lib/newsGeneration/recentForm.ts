/**
 * Últimos partidos de un jugador antes de una fecha dada, en frases compactas de texto
 * plano ("W vs Name 6-4 7-5 — F Miami") — pensado para entrar directo en el prompt de
 * `interviewQuestions.ts` como contexto de forma reciente. Pedido explícito: las
 * preguntas de la entrevista deben poder referirse a la racha/forma de cada jugador, no
 * solo al marcador del propio partido.
 *
 * `beforeDate` excluye a propósito el propio partido de la entrevista (y cualquier cosa
 * posterior) — nunca se filtra por `playerId` de un lado fijo: un jugador puede haber
 * sido "player1" en un partido y "player2" en el siguiente.
 *
 * "Recencia" se calcula con `editions.weekStartDate`, NUNCA `matches.playedAt` —
 * mismo motivo que `lib/matchLog/linkToTourMatch.ts`: `playedAt` está sin rellenar en
 * casi todo el histórico real, y en Finals (lib/finals/mirror.ts) se pisa con la hora
 * de pared en la que un admin registró el resultado, no con cuándo pasó de verdad —
 * bug real reportado: unas Finals de la temporada PASADA, decididas/corregidas ahora
 * por un admin, salían como "lo más reciente" de un jugador por delante de partidos de
 * la temporada actual. Las Finals tampoco tienen `weekStartDate` real (no hay semana
 * ISO que asignarles), así que caen al 31 de diciembre de su año — colocarlas al
 * cierre de esa temporada, nunca por delante de la que sigue.
 */
import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, players } from "@/db/schema";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";

const RECENT_FORM_LOOKBACK = 5;

export async function getRecentFormLines(playerId: number, beforeDate: Date, limit = RECENT_FORM_LOOKBACK): Promise<string[]> {
  const p1 = alias(players, "recent_form_p1");
  const p2 = alias(players, "recent_form_p2");
  const recencyKey: SQL = sql`coalesce(${editions.weekStartDate}, make_date(${editions.year}, 12, 31))`;

  const rows = await db
    .select({
      scoreRaw: matches.scoreRaw,
      outcome: matches.outcome,
      winnerId: matches.winnerId,
      round: matches.round,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: p1.displayName,
      player2Name: p2.displayName,
      eventName: events.displayName,
      drawSize: editions.drawSize,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)), lt(recencyKey, beforeDate)))
    .orderBy(desc(recencyKey))
    .limit(limit);

  return rows
    .filter((r) => r.outcome !== "random") // "Random Luck" — cruce que nunca se llegó a jugar, no es forma real
    .map((r) => {
      const isPlayer1 = r.player1Id === playerId;
      const opponentName = isPlayer1 ? r.player2Name : r.player1Name;
      const won = r.winnerId === playerId;
      const resultTag = r.outcome === "played" ? (won ? "W" : "L") : `${won ? "W" : "L"} (${r.outcome})`;
      const score = r.scoreRaw ? ` ${r.scoreRaw}` : "";
      // El código de ronda en crudo ("Q", "S", "R4"...) no es una etiqueta legible por
      // sí sola — mismo cálculo que usa el resto del sitio para mostrar rondas
      // (MatchCard.tsx, ScoreMatchCard.tsx) para no mandarle al modelo un texto que
      // tenga que adivinar. Bug real reportado: sin esto, el modelo describía una
      // ronda de Quarterfinal como "fourth round" al intentar traducir "Q" él mismo.
      const roundLabel = roundDisplayLabel(fullRoundLadder(r.drawSize), r.round);
      return `${resultTag} vs ${opponentName}${score} — ${roundLabel} ${r.eventName}`;
    });
}
