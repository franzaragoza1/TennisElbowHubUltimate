import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { byes, editions, events, matches, matchVideos, players, rankingSnapshots, sets } from "@/db/schema";
import { PlayerHeader, type PlayerHeaderData } from "@/components/players/PlayerHeader";
import { PlayerLiveBanner } from "@/components/players/PlayerLiveBanner";
import { Sidebar } from "@/components/layout/Sidebar";
import { RankEvolutionChart, type RankPoint } from "@/components/players/RankEvolutionChart";
import { RecentActivity, tournamentSummary, type TournamentActivityGroup } from "@/components/players/RecentActivity";
import { ActivityFilters, type ActivityTier } from "@/components/players/ActivityFilters";
import { PlayerNews } from "@/components/players/PlayerNews";
import { getNewsForPlayer } from "@/lib/newsQueries";
import { compareByRoundProgression } from "@/lib/roundOrder";
import { pairedScoreFromPerspective } from "@/lib/matchScore";
import { getCareerStats } from "@/lib/h2hStats";
import { tournamentCircuit } from "@/lib/tournamentCircuit";

export const revalidate = 3600;

const ACTIVITY_TIERS: ActivityTier[] = ["all", "tour", "challenger", "future"];

export async function generateStaticParams() {
  const rows = await db.select({ id: players.id }).from(players);
  return rows.map((r) => ({ id: String(r.id) }));
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; tier?: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();

  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) notFound();

  const playerNews = await getNewsForPlayer(playerId);
  const currentYear = new Date().getFullYear();
  const requestedParams = await searchParams;

  const [rankHistory, [bestRankWeekRow], careerStats, yearRows] = await Promise.all([
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
    // Temporadas con al menos un partido de este jugador — llena el desplegable de año
    // de "Player activity" y decide el año por defecto (el más reciente con datos, no
    // necesariamente el año en curso: un jugador puede no haber jugado esta temporada).
    db
      .selectDistinct({ year: editions.year })
      .from(matches)
      .innerJoin(editions, eq(matches.editionId, editions.id))
      .where(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)))
      .orderBy(desc(editions.year)),
  ]);

  const availableYears = yearRows.map((r) => r.year);
  const requestedYear = Number(requestedParams.year);
  const selectedYear = availableYears.includes(requestedYear) ? requestedYear : (availableYears[0] ?? currentYear);
  const selectedTier: ActivityTier = ACTIVITY_TIERS.includes(requestedParams.tier as ActivityTier)
    ? (requestedParams.tier as ActivityTier)
    : "all";

  const [matchRows, byeRows] = await Promise.all([
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
          player1Country: sql<string | null>`coalesce(${p1.countryOverride}, ${p1.country})`,
          player2Name: p2.displayName,
          player2Country: sql<string | null>`coalesce(${p2.countryOverride}, ${p2.country})`,
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
        .where(
          and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)), eq(editions.year, selectedYear)),
        )
        // Toda la temporada, no un tope fijo de partidos — la ronda dentro de cada
        // torneo se reordena más abajo (R1 -> F), esto solo decide qué torneo va primero.
        .orderBy(desc(editions.isoWeek));
    })(),
    // Byes de la temporada — pedido explícito: antes se descartaban del todo en esta
    // página (solo entraban en la reconstrucción del cuadro, no en la actividad del
    // jugador), así que una ronda pasada sin jugar desaparecía de su historial.
    db
      .select({
        byeId: byes.id,
        editionId: byes.editionId,
        round: byes.round,
        year: editions.year,
        category: editions.category,
        surface: editions.surface,
        weekStartDate: editions.weekStartDate,
        eventName: events.displayName,
      })
      .from(byes)
      .innerJoin(editions, eq(byes.editionId, editions.id))
      .innerJoin(events, eq(editions.eventId, events.id))
      .where(and(eq(byes.playerId, playerId), eq(editions.year, selectedYear))),
  ]);

  // El ORDER BY de arriba decide qué partidos entran y en qué orden salen los
  // grupos — pero agrupar por (year, isoWeek) no basta: hay semanas con más de un
  // torneo a la vez (p. ej. Los Cabos + Atlanta + Prague, docs/estructura.md §1), así
  // que se agrupa por editionId. Dentro de cada grupo, la BD no garantiza ningún
  // orden de ronda, así que se reordena R1 -> F — partidos y byes intercalados en su
  // sitio real, mismo criterio que ya usa el propio cuadro (parsers/tournamentPage.ts).
  type ActivityRow = ({ kind: "match" } & (typeof matchRows)[number]) | ({ kind: "bye" } & (typeof byeRows)[number]);
  const editionOrder: number[] = [];
  const rowsByEdition = new Map<number, ActivityRow[]>();
  for (const m of matchRows) {
    if (!rowsByEdition.has(m.editionId)) {
      editionOrder.push(m.editionId);
      rowsByEdition.set(m.editionId, []);
    }
    rowsByEdition.get(m.editionId)!.push({ kind: "match", ...m });
  }
  for (const b of byeRows) {
    if (!rowsByEdition.has(b.editionId)) {
      editionOrder.push(b.editionId);
      rowsByEdition.set(b.editionId, []);
    }
    rowsByEdition.get(b.editionId)!.push({ kind: "bye", ...b });
  }
  for (const group of rowsByEdition.values()) {
    group.sort((a, b) => compareByRoundProgression(a.round, b.round));
  }

  const headerData: PlayerHeaderData = {
    displayName: player.displayName,
    country: player.countryOverride ?? player.country,
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
        if (m.kind === "bye") {
          return {
            matchId: -m.byeId, // negativo: nunca choca con un matches.id real (siempre positivo)
            round: m.round,
            opponentId: null,
            opponentName: null,
            opponentCountry: null,
            opponentSeed: null,
            result: "W" as const,
            outcome: "bye" as const,
            scores: [],
            youtubeVideoId: null,
          };
        }
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

  // Nivel elegido, aplicado en JS sobre los grupos ya construidos — mismo criterio de
  // circuito que usa /scores (lib/tournamentCircuit.ts), sin una segunda consulta.
  const filteredGroups =
    selectedTier === "all" ? activityGroups : activityGroups.filter((g) => tournamentCircuit(g.category) === selectedTier);

  // Record y títulos de ESTA temporada/nivel filtrados. Un bye nunca cuenta (no se
  // jugó nada) y, pedido explícito, un w.o. tampoco cuenta como victoria — solo un
  // partido de verdad ganado suma al récord. Un w.o. tampoco cuenta como derrota
  // para quien no pudo jugar (eso no ha cambiado, mismo criterio que getCareerStats):
  // en la práctica, un w.o. tal cual no suma a ningún lado del récord aquí.
  let seasonWins = 0;
  let seasonLosses = 0;
  let seasonTitles = 0;
  for (const g of filteredGroups) {
    for (const m of g.matches) {
      if (m.outcome === "bye" || m.outcome === "walkover") continue;
      if (m.result === "W") seasonWins++;
      else seasonLosses++;
    }
    if (tournamentSummary(g.matches) === "Champion") seasonTitles++;
  }

  return (
    <div>
      <PlayerHeader data={headerData} />
      <PlayerLiveBanner playerId={playerId} />
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <h2 className="text-headline mb-4 text-lg text-ink">Ranking history</h2>
          <div className="rounded-lg border border-rule bg-paper p-4 shadow-sm">
            <RankEvolutionChart data={chartData} />
          </div>

          <PlayerNews stories={playerNews} />

          <h2 className="text-headline mt-10 mb-4 text-lg text-ink">Player activity</h2>
          {availableYears.length > 0 && (
            <ActivityFilters years={availableYears} currentYear={selectedYear} currentTier={selectedTier} />
          )}
          <RecentActivity
            groups={filteredGroups}
            stats={filteredGroups.length > 0 ? { wins: seasonWins, losses: seasonLosses, titles: seasonTitles } : undefined}
            emptyMessage={
              availableYears.length > 0 ? `No matches recorded for ${selectedYear}.` : "No matches on record yet."
            }
          />
        </div>
        <Sidebar hide={["profile"]} />
      </div>
    </div>
  );
}
