import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { news, newsPlayers } from "@/db/schema";

export interface RelatedNewsItem {
  title: string;
  excerpt: string;
  publishedAt: Date | null;
}

const MAX_RELATED_NEWS = 5;

/**
 * Cobertura ya publicada sobre el mismo torneo o alguno de estos jugadores — le da a
 * `enhanceNewsContent` contexto real de lo que ya se contó antes (pedido explícito:
 * "get info from past news too", 2026-09-15), para que un artículo nuevo pueda
 * apoyarse en hechos reales ya establecidos (una racha, un enfrentamiento anterior)
 * sin inventarlos. `excludeNewsId` es el propio artículo que se está editando (null si
 * es uno nuevo) — nunca se cita a sí mismo como "cobertura previa".
 */
export async function getRelatedNews(excludeNewsId: number | null, editionId: number | null, playerIds: number[]): Promise<RelatedNewsItem[]> {
  if (editionId === null && playerIds.length === 0) return [];

  const [idsFromEdition, idsFromPlayers] = await Promise.all([
    editionId !== null
      ? db.select({ id: news.id }).from(news).where(and(eq(news.status, "published"), eq(news.editionId, editionId)))
      : Promise.resolve([]),
    playerIds.length > 0
      ? db
          .select({ id: newsPlayers.newsId })
          .from(newsPlayers)
          .innerJoin(news, eq(news.id, newsPlayers.newsId))
          .where(and(eq(news.status, "published"), inArray(newsPlayers.playerId, playerIds)))
      : Promise.resolve([]),
  ]);

  const candidateIds = new Set([...idsFromEdition.map((r) => r.id), ...idsFromPlayers.map((r) => r.id)]);
  if (excludeNewsId !== null) candidateIds.delete(excludeNewsId);
  if (candidateIds.size === 0) return [];

  return db
    .select({ title: news.title, excerpt: news.excerpt, publishedAt: news.publishedAt })
    .from(news)
    .where(inArray(news.id, [...candidateIds]))
    .orderBy(desc(news.publishedAt))
    .limit(MAX_RELATED_NEWS);
}
