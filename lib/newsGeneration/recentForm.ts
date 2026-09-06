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
 */
import { and, desc, eq, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, players } from "@/db/schema";

const RECENT_FORM_LOOKBACK = 5;

export async function getRecentFormLines(playerId: number, beforeDate: Date, limit = RECENT_FORM_LOOKBACK): Promise<string[]> {
  const p1 = alias(players, "recent_form_p1");
  const p2 = alias(players, "recent_form_p2");

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
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)), lt(matches.playedAt, beforeDate)))
    .orderBy(desc(matches.playedAt))
    .limit(limit);

  return rows
    .filter((r) => r.outcome !== "random") // "Random Luck" — cruce que nunca se llegó a jugar, no es forma real
    .map((r) => {
      const isPlayer1 = r.player1Id === playerId;
      const opponentName = isPlayer1 ? r.player2Name : r.player1Name;
      const won = r.winnerId === playerId;
      const resultTag = r.outcome === "played" ? (won ? "W" : "L") : `${won ? "W" : "L"} (${r.outcome})`;
      const score = r.scoreRaw ? ` ${r.scoreRaw}` : "";
      return `${resultTag} vs ${opponentName}${score} — ${r.round} ${r.eventName}`;
    });
}
