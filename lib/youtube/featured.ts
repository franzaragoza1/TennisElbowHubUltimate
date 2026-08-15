import { desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, matchVideos, players } from "@/db/schema";

export interface FeaturedVideo {
  id: number;
  youtubeVideoId: string;
  title: string;
  /** "P1 vs P2 — Tournament (Round)", cuando el vídeo está enlazado a un partido — si
   * no, se enseña el título del vídeo tal cual y ya está. */
  caption: string | null;
}

/** Los últimos vídeos ya enlazados (auto o confirmados a mano) — nunca uno todavía en
 * revisión, para no anunciar un partido que aún podría estar mal emparejado. */
export async function getFeaturedVideos(limit: number): Promise<FeaturedVideo[]> {
  const rows = await db
    .select()
    .from(matchVideos)
    .where(inArray(matchVideos.status, ["auto", "confirmed"]))
    .orderBy(desc(matchVideos.publishedAt), desc(matchVideos.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.matchId).filter((id): id is number => id !== null);
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const matchRows =
    matchIds.length > 0
      ? await db
          .select({
            id: matches.id,
            round: matches.round,
            player1: p1.displayName,
            player2: p2.displayName,
            eventName: events.displayName,
          })
          .from(matches)
          .innerJoin(editions, eq(matches.editionId, editions.id))
          .innerJoin(events, eq(editions.eventId, events.id))
          .innerJoin(p1, eq(p1.id, matches.player1Id))
          .innerJoin(p2, eq(p2.id, matches.player2Id))
          .where(inArray(matches.id, matchIds))
      : [];
  const matchById = new Map(matchRows.map((m) => [m.id, m]));

  return rows.map((r) => {
    const match = r.matchId ? matchById.get(r.matchId) : undefined;
    return {
      id: r.id,
      youtubeVideoId: r.youtubeVideoId,
      title: r.title,
      caption: match ? `${match.player1} vs ${match.player2} — ${match.eventName} (${match.round})` : null,
    };
  });
}
