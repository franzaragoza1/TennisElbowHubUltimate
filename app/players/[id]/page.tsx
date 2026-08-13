import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { editions, events, matches, players, rankingSnapshots } from "@/db/schema";
import { PlayerHeader, type PlayerHeaderData } from "@/components/players/PlayerHeader";
import { RankEvolutionChart, type RankPoint } from "@/components/players/RankEvolutionChart";
import { MatchHistoryTable, type MatchHistoryRow } from "@/components/players/MatchHistoryTable";
import { PlayerNews } from "@/components/players/PlayerNews";
import { getNewsForPlayer } from "@/lib/newsQueries";

export const revalidate = 3600;

const MATCH_HISTORY_LIMIT = 50;

export async function generateStaticParams() {
  const rows = await db.select({ id: players.id }).from(players);
  return rows.map((r) => ({ id: String(r.id) }));
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();

  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) notFound();

  const playerNews = await getNewsForPlayer(playerId);

  const [rankHistory, [bestRankRow], [currentRankRow], [{ wins }], [{ total }], matchRows] =
    await Promise.all([
      db
        .select({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek, rank: rankingSnapshots.rank })
        .from(rankingSnapshots)
        .where(eq(rankingSnapshots.playerId, playerId))
        .orderBy(asc(rankingSnapshots.isoYear), asc(rankingSnapshots.isoWeek)),
      db
        .select({ rank: rankingSnapshots.rank, isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
        .from(rankingSnapshots)
        .where(eq(rankingSnapshots.playerId, playerId))
        .orderBy(asc(rankingSnapshots.rank))
        .limit(1),
      db
        .select({ rank: rankingSnapshots.rank, points: rankingSnapshots.points })
        .from(rankingSnapshots)
        .where(eq(rankingSnapshots.playerId, playerId))
        .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek))
        .limit(1),
      db
        .select({ wins: sql<number>`count(*)::int` })
        .from(matches)
        .where(eq(matches.winnerId, playerId)),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(matches)
        .where(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId))),
      (() => {
        const p1 = alias(players, "p1");
        const p2 = alias(players, "p2");
        return db
          .select({
            matchId: matches.id,
            editionId: matches.editionId,
            round: matches.round,
            outcome: matches.outcome,
            scoreRaw: matches.scoreRaw,
            winnerId: matches.winnerId,
            player1Id: matches.player1Id,
            player2Id: matches.player2Id,
            player1Name: p1.displayName,
            player2Name: p2.displayName,
            year: editions.year,
            isoWeek: editions.isoWeek,
            eventName: events.displayName,
          })
          .from(matches)
          .innerJoin(editions, eq(matches.editionId, editions.id))
          .innerJoin(events, eq(editions.eventId, events.id))
          .innerJoin(p1, eq(p1.id, matches.player1Id))
          .innerJoin(p2, eq(p2.id, matches.player2Id))
          .where(and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId))))
          .orderBy(desc(editions.year), desc(editions.isoWeek))
          .limit(MATCH_HISTORY_LIMIT);
      })(),
    ]);

  const headerData: PlayerHeaderData = {
    displayName: player.displayName,
    country: player.country,
    character: player.character,
    currentRank: currentRankRow?.rank ?? null,
    currentPoints: currentRankRow?.points ?? null,
    bestRank: bestRankRow?.rank ?? null,
    bestRankWeek: bestRankRow ? `${bestRankRow.isoYear}-W${bestRankRow.isoWeek}` : null,
    wins,
    losses: total - wins,
  };

  const chartData: RankPoint[] = rankHistory.map((r) => ({
    label: `${r.isoYear}-W${r.isoWeek}`,
    rank: r.rank,
  }));

  const historyRows: MatchHistoryRow[] = matchRows.map((m) => {
    const isPlayer1 = m.player1Id === playerId;
    const opponentName = isPlayer1 ? m.player2Name : m.player1Name;
    const result = m.winnerId === playerId ? "W" : "L";
    return {
      matchId: m.matchId,
      editionId: m.editionId,
      year: m.year,
      isoWeek: m.isoWeek,
      eventName: m.eventName,
      round: m.round,
      opponentName,
      result,
      scoreRaw: m.scoreRaw,
    };
  });

  return (
    <div>
      <PlayerHeader data={headerData} />
      <div className="tour-container py-8">
        <h2 className="text-headline mb-4 text-lg text-navy-900">Ranking history</h2>
        <div className="rounded-lg border border-rule bg-paper p-4 shadow-sm">
          <RankEvolutionChart data={chartData} />
        </div>

        <PlayerNews stories={playerNews} />

        <h2 className="text-headline mt-10 mb-4 text-lg text-navy-900">Recent matches</h2>
        <MatchHistoryTable rows={historyRows} />
      </div>
    </div>
  );
}
