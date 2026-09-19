import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { authUsers, discussionTopics, editions, events, follows, liveScoresCache, matches, players, topicComments } from "@/db/schema";
import type { LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

const CACHE_ROW_ID = 1;
const ITEMS_PER_SOURCE = 30;

export type FollowingActivityItem =
  | {
      kind: "match_finished";
      sortAt: number;
      matchId: number;
      editionId: number;
      eventName: string;
      round: string;
      player1Id: number;
      player1Name: string;
      player2Id: number;
      player2Name: string;
      winnerId: number | null;
      scoreRaw: string | null;
    }
  | {
      kind: "topic_comment";
      sortAt: number;
      commentId: number;
      topicId: number;
      topicSlug: string;
      topicTitle: string;
      authorName: string | null;
      body: string;
    }
  | {
      kind: "match_live";
      sortAt: number;
      tournamentName: string;
      roundLabel: string;
      linkHref: string;
      player1Name: string;
      player2Name: string;
    };

/**
 * Vive aparte de app/following/page.tsx (Server Component) por el mismo motivo que
 * lib/latestFeed.ts::mergeChronologically — nada "use client" de por medio aquí, pero
 * mismo criterio de mantener la lógica de mezcla fuera de la propia página.
 */
export async function getFollowingFeed(userId: string): Promise<FollowingActivityItem[]> {
  const followRows = await db.select({ targetType: follows.targetType, targetId: follows.targetId }).from(follows).where(eq(follows.userId, userId));
  if (followRows.length === 0) return [];

  const playerIds = followRows.filter((r) => r.targetType === "player").map((r) => r.targetId);
  const editionIds = followRows.filter((r) => r.targetType === "edition").map((r) => r.targetId);
  const topicIds = followRows.filter((r) => r.targetType === "topic").map((r) => r.targetId);

  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  const [finishedMatches, topicActivity, liveRow] = await Promise.all([
    playerIds.length === 0 && editionIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: matches.id,
            editionId: matches.editionId,
            eventName: events.displayName,
            round: matches.round,
            player1Id: matches.player1Id,
            player1Name: p1.displayName,
            player2Id: matches.player2Id,
            player2Name: p2.displayName,
            winnerId: matches.winnerId,
            scoreRaw: matches.scoreRaw,
            playedAt: matches.playedAt,
          })
          .from(matches)
          .innerJoin(editions, eq(editions.id, matches.editionId))
          .innerJoin(events, eq(events.id, editions.eventId))
          .innerJoin(p1, eq(p1.id, matches.player1Id))
          .innerJoin(p2, eq(p2.id, matches.player2Id))
          .where(
            and(
              isNotNull(matches.winnerId),
              or(
                editionIds.length > 0 ? inArray(matches.editionId, editionIds) : undefined,
                playerIds.length > 0 ? inArray(matches.player1Id, playerIds) : undefined,
                playerIds.length > 0 ? inArray(matches.player2Id, playerIds) : undefined,
              ),
            ),
          )
          .orderBy(desc(matches.playedAt))
          .limit(ITEMS_PER_SOURCE),
    topicIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: topicComments.id,
            topicId: topicComments.topicId,
            topicSlug: discussionTopics.slug,
            topicTitle: discussionTopics.title,
            authorName: authUsers.name,
            body: topicComments.body,
            createdAt: topicComments.createdAt,
          })
          .from(topicComments)
          .innerJoin(discussionTopics, eq(discussionTopics.id, topicComments.topicId))
          .innerJoin(authUsers, eq(authUsers.id, topicComments.userId))
          .where(inArray(topicComments.topicId, topicIds))
          .orderBy(desc(topicComments.createdAt))
          .limit(ITEMS_PER_SOURCE),
    db.select({ matches: liveScoresCache.matches }).from(liveScoresCache).where(eq(liveScoresCache.id, CACHE_ROW_ID)),
  ]);

  const items: FollowingActivityItem[] = [];

  for (const m of finishedMatches) {
    items.push({
      kind: "match_finished",
      sortAt: m.playedAt?.getTime() ?? 0,
      matchId: m.id,
      editionId: m.editionId,
      eventName: m.eventName,
      round: m.round,
      player1Id: m.player1Id!,
      player1Name: m.player1Name,
      player2Id: m.player2Id!,
      player2Name: m.player2Name,
      winnerId: m.winnerId,
      scoreRaw: m.scoreRaw,
    });
  }

  for (const c of topicActivity) {
    items.push({
      kind: "topic_comment",
      sortAt: c.createdAt.getTime(),
      commentId: c.id,
      topicId: c.topicId,
      topicSlug: c.topicSlug,
      topicTitle: c.topicTitle,
      authorName: c.authorName,
      body: c.body,
    });
  }

  // Vivo ahora mismo, filtrado a jugadores seguidos — sin `editionId` todavía en
  // `LiveTourMatch` (llega en la fase de push notifications), así que por ahora solo se
  // filtra por jugador, no por torneo seguido. Se ancla al principio del feed (sortAt en
  // el futuro) para que siempre aparezca arriba mientras dure.
  const playerIdSet = new Set(playerIds);
  const liveMatches = (liveRow[0]?.matches ?? []) as LiveTourMatch[];
  for (const m of liveMatches) {
    if (!playerIdSet.has(m.player1.id) && !playerIdSet.has(m.player2.id)) continue;
    items.push({
      kind: "match_live",
      sortAt: Date.now() + 1000 * 60 * 60 * 24 * 365, // siempre arriba mientras esté en vivo
      tournamentName: m.tournamentName,
      roundLabel: m.roundLabel,
      linkHref: m.linkHref,
      player1Name: m.player1.displayName,
      player2Name: m.player2.displayName,
    });
  }

  items.sort((a, b) => b.sortAt - a.sortAt);
  return items;
}
