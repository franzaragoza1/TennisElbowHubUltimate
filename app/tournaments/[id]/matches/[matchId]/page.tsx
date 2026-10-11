import { and, asc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { discordInterviewThreads, editions, events, matches, matchStats, players, sets } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { OUTCOME_LABEL, type MatchCardData } from "@/components/tournament/MatchCard";
import { MatchStatsPanel, type MatchStatsPanelData } from "@/components/matches/MatchStatsPanel";
import { InterviewTranscript } from "@/components/news/InterviewTranscript";
import { getInterviewTranscript } from "@/lib/newsQueries";
import { pairedScoreFromPerspective } from "@/lib/matchScore";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { surfaceColor, surfaceDisplayLabel } from "@/lib/surfaceColors";

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
  preloadSidebar();
  const { id, matchId: matchIdRaw } = await params;
  const editionId = Number(id);
  if (!Number.isInteger(editionId)) notFound();

  // Dos formas posibles del segmento (ver el comentario de `matchDetailHref`,
  // components/tournament/MatchCard.tsx): la nueva, estable, "RONDA-idA-idB" (ronda +
  // pareja de jugadores sin orden — sobrevive a que la edición se recargue, a
  // diferencia de un `matches.id` crudo), o la vieja, un `matches.id` a secas, para
  // cualquier enlace ya repartido antes de este cambio (Discord, marcadores,
  // pestañas abiertas...). Nunca se intentan las dos formas a la vez: el propio
  // formato del segmento ya dice cuál usar.
  const slugMatch = /^([A-Za-z0-9]+)-(\d+)-(\d+)$/.exec(matchIdRaw);
  const legacyMatchId = slugMatch ? null : Number(matchIdRaw);
  if (!slugMatch && !Number.isInteger(legacyMatchId)) notFound();

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
      player1AvatarUrl: p1.avatarUrl,
      player2Name: p2.displayName,
      player2Country: p2.country,
      player2CountryOverride: p2.countryOverride,
      player2AvatarUrl: p2.avatarUrl,
    })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(
      and(
        eq(matches.editionId, editionId),
        slugMatch
          ? and(
              eq(matches.round, slugMatch[1]),
              or(
                and(eq(matches.player1Id, Number(slugMatch[2])), eq(matches.player2Id, Number(slugMatch[3]))),
                and(eq(matches.player1Id, Number(slugMatch[3])), eq(matches.player2Id, Number(slugMatch[2]))),
              ),
            )
          : eq(matches.id, legacyMatchId!),
      ),
    );
  if (!match || !match.player1Id || !match.player2Id) notFound();

  const matchSets = await db
    .select({
      setNumber: sets.setNumber,
      winnerGames: sets.winnerGames,
      loserGames: sets.loserGames,
      tiebreakLoserPoints: sets.tiebreakLoserPoints,
    })
    .from(sets)
    .where(eq(sets.matchId, match.id))
    .orderBy(asc(sets.setNumber));

  const statsRows = await db.select().from(matchStats).where(eq(matchStats.matchId, match.id));
  const stats1 = statsRows.find((s) => s.playerId === match.player1Id) ?? null;
  const stats2 = statsRows.find((s) => s.playerId === match.player2Id) ?? null;

  // Un hilo de entrevista no guarda `matchId` — se empareja por ronda + pareja de
  // jugadores sin orden, mismo criterio que `lib/tournamentBracketData.ts` (el icono
  // del cuadro que trae aquí). Independiente de si hay `match_stats` o no: una
  // entrevista de verdad completada se enseña aunque no haya ninguna estadística
  // registrada (pedido explícito, 2026-09-17: "I dont think they meant only when its
  // published on articles" — tampoco depende de que exista un artículo).
  const [interviewThread] = await db
    .select({ id: discordInterviewThreads.id, qa: discordInterviewThreads.qa })
    .from(discordInterviewThreads)
    .where(
      and(
        eq(discordInterviewThreads.editionId, editionId),
        eq(discordInterviewThreads.round, match.round),
        eq(discordInterviewThreads.status, "completed"),
        or(
          and(eq(discordInterviewThreads.playerId, match.player1Id), eq(discordInterviewThreads.opponentId, match.player2Id)),
          and(eq(discordInterviewThreads.playerId, match.player2Id), eq(discordInterviewThreads.opponentId, match.player1Id)),
        ),
      ),
    );
  const interviewTranscript =
    interviewThread && interviewThread.qa.length > 0 ? await getInterviewTranscript(interviewThread.id) : null;

  const player1WonMatch = match.winnerId === match.player1Id;
  const pairedScore = pairedScoreFromPerspective(matchSets, player1WonMatch);
  const outcomeLabel = match.outcome !== "played" ? OUTCOME_LABEL[match.outcome as Exclude<MatchCardData["outcome"], "played">] : null;
  const ladder = fullRoundLadder(edition.drawSize);
  const roundLabel = roundDisplayLabel(ladder, match.round);

  return (
    <div>
      <PageMasthead
        eyebrow={`${edition.eventName} · ${[edition.category, surfaceDisplayLabel(edition.surface)].filter(Boolean).join(" · ")} · ${roundLabel}`}
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

          {/* Independiente de si hay estadísticas — una entrevista real no depende de
           * que exista ninguna (ver el comentario largo junto a la consulta, arriba).
           * `InterviewTranscript` ya trae su propio `mt-10`, sin envoltorio extra. */}
          {interviewTranscript && <InterviewTranscript transcript={interviewTranscript} />}
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
  avatarUrl,
  seed,
  isWinner,
  align,
}: {
  id: number;
  name: string;
  country: string | null;
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
      <PlayerAvatar displayName={name} country={country} avatarUrl={avatarUrl} size="lg" />
      <span className={`min-w-0 truncate text-lg ${isWinner ? "text-headline text-ink" : "text-muted-label"}`}>
        {name}
        {seed && <span className="text-muted-label font-normal"> ({seed})</span>}
      </span>
    </Link>
  );
}
