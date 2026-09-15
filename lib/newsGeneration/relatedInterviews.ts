import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { discordInterviewThreads, players } from "@/db/schema";

export interface RelatedInterviewQuote {
  playerName: string;
  qa: { question: string; answer: string }[];
}

/**
 * Entrevistas YA COMPLETADAS (nunca `in_progress`) de estos jugadores en este mismo
 * torneo — usado por `lib/newsGeneration/enhance.ts` para tejer citas reales dentro de
 * un artículo que un admin ya está escribiendo a mano. Acotado por `editionId`: sin
 * eso, la entrevista de un jugador en OTRO torneo se colaría como si fuera de este.
 */
export async function getRelatedInterviewQuotes(editionId: number, playerIds: number[]): Promise<RelatedInterviewQuote[]> {
  if (playerIds.length === 0) return [];

  const rows = await db
    .select({
      playerName: players.displayName,
      qa: discordInterviewThreads.qa,
    })
    .from(discordInterviewThreads)
    .innerJoin(players, eq(players.id, discordInterviewThreads.playerId))
    .where(
      and(
        eq(discordInterviewThreads.editionId, editionId),
        eq(discordInterviewThreads.status, "completed"),
        inArray(discordInterviewThreads.playerId, playerIds),
      ),
    );

  return rows.filter((r) => r.qa.length > 0);
}
