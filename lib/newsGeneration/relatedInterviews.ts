import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { discordInterviewThreads, players } from "@/db/schema";

export interface RelatedInterviewQuote {
  playerName: string;
  qa: { question: string; answer: string }[];
}

const MAX_RELATED_INTERVIEWS = 5;

/**
 * Entrevistas YA COMPLETADAS (nunca `in_progress`) de los jugadores etiquetados —
 * antes exigía el MISMO `editionId` que el artículo, lo que dejaba sin nada cualquier
 * artículo sobre un jugador sin torneo elegido, o sobre un torneo sin entrevista
 * propia. Pedido explícito: "finds interviews that are likely related to the topic of
 * the article" (2026-09-15) — ahora prioriza el mismo torneo si lo hay, y completa el
 * resto con las más recientes de ese jugador en cualquier otro, en vez de exigir una
 * coincidencia exacta.
 */
export async function getRelatedInterviewQuotes(editionId: number | null, playerIds: number[]): Promise<RelatedInterviewQuote[]> {
  if (playerIds.length === 0) return [];

  const rows = await db
    .select({
      playerName: players.displayName,
      editionId: discordInterviewThreads.editionId,
      qa: discordInterviewThreads.qa,
    })
    .from(discordInterviewThreads)
    .innerJoin(players, eq(players.id, discordInterviewThreads.playerId))
    .where(and(eq(discordInterviewThreads.status, "completed"), inArray(discordInterviewThreads.playerId, playerIds)))
    .orderBy(desc(discordInterviewThreads.createdAt));

  const withQa = rows.filter((r) => r.qa.length > 0);
  // El mismo torneo primero — dentro de cada grupo se conserva el orden por
  // recencia de la query (Array.prototype.sort es estable).
  withQa.sort((a, b) => {
    const aMatch = editionId !== null && a.editionId === editionId ? 1 : 0;
    const bMatch = editionId !== null && b.editionId === editionId ? 1 : 0;
    return bMatch - aMatch;
  });

  return withQa.slice(0, MAX_RELATED_INTERVIEWS).map((r) => ({ playerName: r.playerName, qa: r.qa }));
}
