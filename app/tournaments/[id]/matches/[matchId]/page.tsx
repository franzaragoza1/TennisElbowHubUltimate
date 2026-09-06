import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { editions, events, matches, matchStats, players, sets } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { OUTCOME_LABEL, type MatchCardData } from "@/components/tournament/MatchCard";
import { MatchStatsPanel, type MatchStatsPanelData } from "@/components/matches/MatchStatsPanel";
import { pairedScoreFromPerspective } from "@/lib/matchScore";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { surfaceColor } from "@/lib/surfaceColors";

export const revalidate = 600;

const EMPTY_STATS: MatchStatsPanelData = {
  aces: null,
  doubleFaults: null,
  firstServeAttempted: null,
  firstServeIn: null,
  firstServePointsPlayed: null,
  firstServePointsWon: null,
  secondServePointsPlayed: null,
  secondServePointsWon: null,
  breakPointsFaced: null,
  breakPointsWon: null,
  returnPointsPlayed: null,
  returnPointsWon: null,
  netPointsPlayed: null,
  netPointsWon: null,
  winners: null,
  forcedErrors: null,
  unforcedErrors: null,
  totalPointsWon: null,
  fastestServeKmh: null,
  avgFirstServeSpeedKmh: null,
  avgSecondServeSpeedKmh: null,
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId: matchIdRaw } = await params;
  const editionId = Number(id);
  const matchId = Number(matchIdRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(matchId)) notFound();

  const [edition] = await db
    .select({
      id: editions.id,
      year: editions.year,
      isoWeek: editions.isoWeek,
      surface: editions.surface,
      category: editions.category,
      drawSize: editions.drawSize,
      eventName: events.displayName,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(eq(editions.id, editionId));
  if (!edition) notFound();

  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  // El `editionId` en la URL no es solo cosmético: sin este filtro, un `matchId` de
  // OTRO torneo devolvería igualmente una página (ficha de partido correcta, pero
  // colgada de una URL de torneo que no es la suya).
  const [match] = await db
    .select({
      id: matches.id,
      round: matches.round,
      outcome: matches.outcome,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Seed: matches.player1Seed,
      player2Seed: matches.player2Seed,
      player1Name: p1.displayName,
      player1Country: p1.country,
      player1CountryOverride: p1.countryOverride,
      player1Character: p1.character,
      player1AvatarUrl: p1.avatarUrl,
      player2Name: p2.displayName,
      player2Country: p2.country,
      player2CountryOverride: p2.countryOverride,
      player2Character: p2.character,
      player2AvatarUrl: p2.avatarUrl,
    })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(and(eq(matches.id, matchId), eq(matches.editionId, editionId)));
  if (!match || !match.player1Id || !match.player2Id) notFound();

  const matchSets = await db
    .select({
      setNumber: sets.setNumber,
      winnerGames: sets.winnerGames,
      loserGames: sets.loserGames,
      tiebreakLoserPoints: sets.tiebreakLoserPoints,
    })
    .from(sets)
    .where(eq(sets.matchId, matchId))
    .orderBy(asc(sets.setNumber));

  const statsRows = await db.select().from(matchStats).where(eq(matchStats.matchId, matchId));
  const stats1 = statsRows.find((s) => s.playerId === match.player1Id) ?? null;
  const stats2 = statsRows.find((s) => s.playerId === match.player2Id) ?? null;

  const player1WonMatch = match.winnerId === match.player1Id;
  const pairedScore = pairedScoreFromPerspective(matchSets, player1WonMatch);
  const outcomeLabel = match.outcome !== "played" ? OUTCOME_LABEL[match.outcome as Exclude<MatchCardData["outcome"], "played">] : null;
  const ladder = fullRoundLadder(edition.drawSize);
  const roundLabel = roundDisplayLabel(ladder, match.round);

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.eventName} · ${[edition.category, edition.surface].filter(Boolean).join(" · ")} · ${roundLabel}`}
        title={`${match.player1Name} vs ${match.player2Name}`}
        subtitle={
          <Link href={`/tournaments/${edition.id}`} className="hover:underline">
            ← Back to the draw
          </Link>
        }
        accentColor={surfaceColor(edition.surface)}
      />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper p-5 shadow-sm">
            <PlayerCol
              id={match.player1Id}
              name={match.player1Name}
              country={match.player1CountryOverride ?? match.player1Country}
              character={match.player1Character}
              avatarUrl={match.player1AvatarUrl}
              seed={match.player1Seed}
              isWinner={player1WonMatch}
              align="left"
            />
            <div className="shrink-0 text-center">
              <div className="tour-numeric text-headline flex items-center gap-2 text-2xl text-ink">
                {pairedScore.map((s, i) => (
                  <span key={i} className="relative">
                    {s.playerGames}
                    {s.playerSuperscript !== null && (
                      <sup className="absolute -right-2 top-0 text-xs font-normal">{s.playerSuperscript}</sup>
                    )}
                    <span className="text-muted-label mx-0.5">-</span>
                    {s.opponentGames}
                    {s.opponentSuperscript !== null && (
                      <sup className="absolute -right-2 top-0 text-xs font-normal">{s.opponentSuperscript}</sup>
                    )}
                  </span>
                ))}
              </div>
              {outcomeLabel && <p className="text-eyebrow mt-1 text-[10px] text-muted-label">{outcomeLabel}</p>}
            </div>
            <PlayerCol
              id={match.player2Id}
              name={match.player2Name}
              country={match.player2CountryOverride ?? match.player2Country}
              character={match.player2Character}
              avatarUrl={match.player2AvatarUrl}
              seed={match.player2Seed}
              isWinner={!player1WonMatch}
              align="right"
            />
          </div>

          {stats1 && stats2 ? (
            <div className="rounded-lg bg-navy-900 p-5">
              <h2 className="text-headline mb-2 text-lg text-white">Match stats</h2>
              <MatchStatsPanel player1={stats1 ?? EMPTY_STATS} player2={stats2 ?? EMPTY_STATS} />
            </div>
          ) : (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
              No detailed stats recorded for this match yet.
            </p>
          )}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}

function PlayerCol({
  id,
  name,
  country,
  character,
  avatarUrl,
  seed,
  isWinner,
  align,
}: {
  id: number;
  name: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  seed: number | null;
  isWinner: boolean;
  align: "left" | "right";
}) {
  return (
    <Link
      href={`/players/${id}`}
      className={`flex min-w-0 flex-1 items-center gap-3 hover:underline ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <PlayerAvatar displayName={name} country={country} character={character} avatarUrl={avatarUrl} size="lg" />
      <span className={`min-w-0 truncate text-lg ${isWinner ? "text-headline text-ink" : "text-muted-label"}`}>
        {name}
        {seed && <span className="text-muted-label font-normal"> ({seed})</span>}
      </span>
    </Link>
  );
}
