import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { editions, events, pendingSlots, players } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { H2HHeader, type H2HPlayerInfo } from "@/components/h2h/H2HHeader";
import { H2HWinPrediction } from "@/components/h2h/H2HWinPrediction";
import { H2HStatsRow } from "@/components/h2h/H2HStatsRow";
import { getCareerStats, getH2HMeetings } from "@/lib/h2hStats";
import { getPreMatchWinProbability } from "@/lib/predictor/preMatch";
import { getLatestRankingWeek } from "@/lib/tourQueries";
import { getMatchPreviewNarrative, type MatchPreviewFacts } from "@/lib/matchPreviewNarrative";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";

export const revalidate = 600;

function rankingLabel(rank: number | null): string {
  return rank ? `#${rank}` : "unranked";
}

export default async function MatchPreviewPage({
  params,
}: {
  params: Promise<{ id: string; slotId: string }>;
}) {
  const { id, slotId: slotIdRaw } = await params;
  const editionId = Number(id);
  const slotId = Number(slotIdRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(slotId)) notFound();

  const [edition] = await db
    .select({
      id: editions.id,
      year: editions.year,
      isoWeek: editions.isoWeek,
      drawSize: editions.drawSize,
      surface: editions.surface,
      category: editions.category,
      eventName: events.displayName,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(eq(editions.id, editionId));
  if (!edition) notFound();

  const [slot] = await db
    .select({ round: pendingSlots.round, player1Id: pendingSlots.player1Id, player2Id: pendingSlots.player2Id })
    .from(pendingSlots)
    .where(and(eq(pendingSlots.id, slotId), eq(pendingSlots.editionId, editionId)));
  // No es un preview válido si el cruce ya no está ahí (se decidió mientras tanto) o
  // si todavía le falta un lado real (TBD) — nunca se enseña una comparativa a medias.
  if (!slot || slot.player1Id === null || slot.player2Id === null) notFound();
  const player1Id = slot.player1Id;
  const player2Id = slot.player2Id;

  const p1 = alias(players, "preview_p1");
  const p2 = alias(players, "preview_p2");
  const [playerRows, currentYear] = await Promise.all([
    db
      .select({
        p1Id: p1.id,
        p1Name: p1.displayName,
        p1Country: p1.countryOverride,
        p1CountryFallback: p1.country,
        p1Avatar: p1.avatarUrl,
        p2Id: p2.id,
        p2Name: p2.displayName,
        p2Country: p2.countryOverride,
        p2CountryFallback: p2.country,
        p2Avatar: p2.avatarUrl,
      })
      .from(p1)
      .innerJoin(p2, eq(p2.id, player2Id))
      .where(eq(p1.id, player1Id)),
    Promise.resolve(new Date().getFullYear()),
  ]);
  const row = playerRows[0];
  if (!row) notFound();

  const [stats1, stats2, meetings, winProbability, latestWeek] = await Promise.all([
    getCareerStats(player1Id, currentYear),
    getCareerStats(player2Id, currentYear),
    getH2HMeetings(player1Id, player2Id),
    getPreMatchWinProbability(player1Id, player2Id),
    getLatestRankingWeek(),
  ]);

  const player1: H2HPlayerInfo = {
    id: player1Id,
    displayName: row.p1Name,
    country: row.p1Country ?? row.p1CountryFallback,
    avatarUrl: row.p1Avatar,
    currentRank: stats1.currentRank,
    currentPoints: stats1.currentPoints,
    careerHigh: stats1.careerHigh,
    proSince: stats1.firstSeenYear,
  };
  const player2: H2HPlayerInfo = {
    id: player2Id,
    displayName: row.p2Name,
    country: row.p2Country ?? row.p2CountryFallback,
    avatarUrl: row.p2Avatar,
    currentRank: stats2.currentRank,
    currentPoints: stats2.currentPoints,
    careerHigh: stats2.careerHigh,
    proSince: stats2.firstSeenYear,
  };

  const decisiveMeetings = meetings.filter((m) => m.outcome !== "walkover");
  const h2hWins1 = decisiveMeetings.filter((m) => m.winnerId === player1Id).length;
  const h2hWins2 = decisiveMeetings.filter((m) => m.winnerId === player2Id).length;

  const roundLabel = roundDisplayLabel(fullRoundLadder(edition.drawSize), slot.round);

  const facts: MatchPreviewFacts = {
    playerA: player1.displayName,
    playerB: player2.displayName,
    tournament: edition.eventName,
    round: roundLabel,
    surface: edition.surface,
    rankingA: rankingLabel(stats1.currentRank),
    rankingB: rankingLabel(stats2.currentRank),
    headToHead: { playerA: h2hWins1, playerB: h2hWins2, totalMeetings: decisiveMeetings.length },
    recentFormA: `${stats1.yearWins}-${stats1.yearLosses} this season`,
    recentFormB: `${stats2.yearWins}-${stats2.yearLosses} this season`,
    careerWinPctA: stats1.winPct,
    careerWinPctB: stats2.winPct,
    winProbabilityA: Math.round(winProbability.player1 * 100),
    winProbabilityB: Math.round(winProbability.player2 * 100),
  };
  // Cambia en cuanto haya algo nuevo de verdad: nueva semana de ranking publicada, o
  // cualquiera de los dos juega un partido nuevo (career_wins+career_losses sube) — y
  // solo entonces, igual que lib/h2hNarrative.ts.
  const fingerprint = `${latestWeek?.isoYear ?? 0}-${latestWeek?.isoWeek ?? 0}:${stats1.careerWins + stats1.careerLosses}:${stats2.careerWins + stats2.careerLosses}:${decisiveMeetings.length}`;
  const narrative = await getMatchPreviewNarrative(slotId, facts, fingerprint);

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.eventName} · ${[edition.category, surfaceDisplayLabel(edition.surface)].filter(Boolean).join(" · ")} · ${roundLabel}`}
        title="Match Preview"
        subtitle={
          <Link href={`/tournaments/${edition.id}`} className="hover:underline">
            ← Back to the draw
          </Link>
        }
        accentColor={edition.surface ? surfaceColor(edition.surface) : undefined}
      />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="rounded-lg bg-navy-900 p-1">
            <H2HHeader player1={player1} player2={player2} player1Wins={h2hWins1} player2Wins={h2hWins2} />
          </div>

          <div className="rounded-b-lg bg-navy-900 pb-8">
            <div className="tour-container tour-container--reading pt-6">
              <H2HWinPrediction player1={player1} player2={player2} winProbability={winProbability} />

              {narrative && <p className="mt-6 text-sm leading-relaxed text-white/80">{narrative}</p>}

              <div className="mt-8">
                <H2HStatsRow label="This season W/L" value1={stats1.yearWins} value2={stats2.yearWins} detail1={`/${stats1.yearLosses}`} detail2={`/${stats2.yearLosses}`} />
                <H2HStatsRow label="Career win %" value1={stats1.winPct} value2={stats2.winPct} detail1="%" detail2="%" />
                <H2HStatsRow label="Head-to-head" value1={h2hWins1} value2={h2hWins2} />
                <H2HStatsRow label="Career titles" value1={stats1.careerTitles} value2={stats2.careerTitles} />
              </div>

              <p className="text-muted-label mt-6 text-xs text-white/50">
                This match hasn&apos;t been played yet — check back after the deadline for the real result and match stats.
              </p>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
