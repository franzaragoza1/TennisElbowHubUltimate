import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { editions, events, matches, matchVideos, players, rankingSnapshots, sets } from "@/db/schema";
import { PlayerHeader, type PlayerHeaderData } from "@/components/players/PlayerHeader";
import { RankEvolutionChart, type RankPoint } from "@/components/players/RankEvolutionChart";
import { RecentActivity, type TournamentActivityGroup } from "@/components/players/RecentActivity";
import { PlayerNews } from "@/components/players/PlayerNews";
import { getNewsForPlayer } from "@/lib/newsQueries";
import { compareByRoundProgression } from "@/lib/roundOrder";
import { pairedScoreFromPerspective } from "@/lib/matchScore";
import { getCareerStats } from "@/lib/h2hStats";

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
  const currentYear = new Date().getFullYear();

  const [rankHistory, [bestRankWeekRow], careerStats, matchRows] =
    await Promise.all([
      db
        .select({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek, rank: rankingSnapshots.rank })
        .from(rankingSnapshots)
        .where(and(eq(rankingSnapshots.playerId, playerId), eq(rankingSnapshots.kind, "official")))
        .orderBy(asc(rankingSnapshots.isoYear), asc(rankingSnapshots.isoWeek)),
      db
        .select({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
        .from(rankingSnapshots)
        .where(and(eq(rankingSnapshots.playerId, playerId), eq(rankingSnapshots.kind, "official")))
        .orderBy(asc(rankingSnapshots.rank))
        .limit(1),
      getCareerStats(playerId, currentYear),
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
            player1Seed: matches.player1Seed,
            player2Seed: matches.player2Seed,
            player1Name: p1.displayName,
            player1Country: p1.country,
            player2Name: p2.displayName,
            player2Country: p2.country,
            year: editions.year,
            isoWeek: editions.isoWeek,
            category: editions.category,
            surface: editions.surface,
            weekStartDate: editions.weekStartDate,
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

  // El ORDER BY de arriba decide qué 50 partidos entran (los de los torneos más
  // recientes) y en qué orden salen los grupos — pero agrupar por (year, isoWeek) no
  // basta: hay semanas con más de un torneo a la vez (p. ej. Los Cabos + Atlanta +
  // Prague, docs/estructura.md §1), así que se agrupa por editionId. Dentro de cada
  // grupo, la BD no garantiza ningún orden de ronda, así que se reordena R1 -> F.
  const editionOrder: number[] = [];
  const rowsByEdition = new Map<number, typeof matchRows>();
  for (const m of matchRows) {
    if (!rowsByEdition.has(m.editionId)) {
      editionOrder.push(m.editionId);
      rowsByEdition.set(m.editionId, []);
    }
    rowsByEdition.get(m.editionId)!.push(m);
  }
  for (const group of rowsByEdition.values()) {
    group.sort((a, b) => compareByRoundProgression(a.round, b.round));
  }

  const headerData: PlayerHeaderData = {
    displayName: player.displayName,
    country: player.country,
    character: player.character,
    currentRank: careerStats.currentRank,
    currentPoints: careerStats.currentPoints,
    careerHigh: careerStats.careerHigh,
    bestRankWeek: bestRankWeekRow ? `${bestRankWeekRow.isoYear}-W${bestRankWeekRow.isoWeek}` : null,
    yearWins: careerStats.yearWins,
    yearLosses: careerStats.yearLosses,
    yearTitles: careerStats.yearTitles,
    careerWins: careerStats.careerWins,
    careerLosses: careerStats.careerLosses,
    careerTitles: careerStats.careerTitles,
  };

  const chartData: RankPoint[] = rankHistory.map((r) => ({
    label: `${r.isoYear}-W${r.isoWeek}`,
    rank: r.rank,
  }));

  const historyMatchIds = matchRows.map((m) => m.matchId);
  const [videoRows, setRows] = await Promise.all([
    historyMatchIds.length > 0
      ? db
          .select({ matchId: matchVideos.matchId, youtubeVideoId: matchVideos.youtubeVideoId })
          .from(matchVideos)
          .where(and(inArray(matchVideos.matchId, historyMatchIds), inArray(matchVideos.status, ["auto", "confirmed"])))
      : Promise.resolve([]),
    historyMatchIds.length > 0
      ? db.select().from(sets).where(inArray(sets.matchId, historyMatchIds))
      : Promise.resolve([] as (typeof sets.$inferSelect)[]),
  ]);
  const videoByMatch = new Map(videoRows.filter((v) => v.matchId !== null).map((v) => [v.matchId!, v.youtubeVideoId]));
  const setsByMatch = new Map<number, typeof setRows>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push(s);
  }
  for (const list of setsByMatch.values()) list.sort((a, b) => a.setNumber - b.setNumber);

  const activityGroups: TournamentActivityGroup[] = editionOrder.map((editionId) => {
    const rows = rowsByEdition.get(editionId)!;
    const first = rows[0];
    return {
      editionId,
      eventName: first.eventName,
      category: first.category,
      surface: first.surface,
      weekStartDate: first.weekStartDate,
      matches: rows.map((m) => {
        const isPlayer1 = m.player1Id === playerId;
        const opponentId = isPlayer1 ? m.player2Id! : m.player1Id!;
        const opponentName = isPlayer1 ? m.player2Name : m.player1Name;
        const opponentCountry = isPlayer1 ? m.player2Country : m.player1Country;
        const opponentSeed = isPlayer1 ? m.player2Seed : m.player1Seed;
        const playerWonMatch = m.winnerId === playerId;
        return {
          matchId: m.matchId,
          round: m.round,
          opponentId,
          opponentName,
          opponentCountry,
          opponentSeed,
          result: playerWonMatch ? "W" : "L",
          outcome: m.outcome as TournamentActivityGroup["matches"][number]["outcome"],
          scores: pairedScoreFromPerspective(setsByMatch.get(m.matchId) ?? [], playerWonMatch),
          youtubeVideoId: videoByMatch.get(m.matchId) ?? null,
        };
      }),
    };
  });

  return (
    <div>
      <PlayerHeader data={headerData} />
      <div className="tour-container py-8">
        <h2 className="text-headline mb-4 text-lg text-ink">Ranking history</h2>
        <div className="rounded-lg border border-rule bg-paper p-4 shadow-sm">
          <RankEvolutionChart data={chartData} />
        </div>

        <PlayerNews stories={playerNews} />

        <h2 className="text-headline mt-10 mb-4 text-lg text-ink">Recent activity</h2>
        <RecentActivity groups={activityGroups} />
      </div>
    </div>
  );
}
