import { and, asc, desc, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { byes, editions, events, matches, matchVideos, playerBuilds, players, rankingSnapshots, sets } from "@/db/schema";
import { PlayerHeader, type PlayerHeaderData } from "@/components/players/PlayerHeader";
import { PlayerLiveBanner } from "@/components/players/PlayerLiveBanner";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { SectionShell, type ShellSection } from "@/components/layout/SectionShell";
import { RankEvolutionChart, type RankPoint } from "@/components/players/RankEvolutionChart";
import { RecentActivity, tournamentSummary, type TournamentActivityGroup } from "@/components/players/RecentActivity";
import { ActivityFilters, type ActivityTier } from "@/components/players/ActivityFilters";
import { CompactLatestList } from "@/components/news/LatestFeed";
import { mergeChronologically } from "@/lib/latestFeed";
import { PlayerFactsCard } from "@/components/players/PlayerFactsCard";
import { PlayerPalmares } from "@/components/players/PlayerPalmares";
import { PlayerAwards } from "@/components/players/PlayerAwards";
import { PlayerBuildCard } from "@/components/players/PlayerBuildCard";
import { getNewsForPlayer } from "@/lib/newsQueries";
import { getVideosForPlayer } from "@/lib/youtube/featured";
import { compareByRoundProgression } from "@/lib/roundOrder";
import { pairedScoreFromPerspective } from "@/lib/matchScore";
import { getCareerStats, getPalmares } from "@/lib/h2hStats";
import { hasVisibleBuilds } from "@/lib/buildStats";
import { getPlayerAwardWins } from "@/lib/awards/queries";
import { memoizeWithTtl } from "@/lib/memoCache";
import { tournamentCircuit } from "@/lib/tournamentCircuit";
import { getCurrentUser } from "@/lib/auth";
import { isFollowing } from "@/lib/follows";
import { toggleFollow } from "@/app/follows/actions";
import { FollowButton } from "@/components/follows/FollowButton";
import { getPlayerSocialStats } from "@/lib/playerSocialStats";

export const revalidate = 3600;

// Premios ganados: solo cambian al cerrarse un periodo, y para un ganador eran tres
// viajes seguidos a la BD (periodos → nominaciones → sets/vídeos) — el más largo de la
// primera tanda de la ficha. Un argumento, así que `memoizeWithTtl` es seguro aquí
// (ver lib/memoCache.ts). Pase de rendimiento, 2026-10-11.
const getPlayerAwardWinsCached = memoizeWithTtl(getPlayerAwardWins, 600_000);

const ACTIVITY_TIERS: ActivityTier[] = ["all", "tour", "challenger", "future"];

export async function generateStaticParams() {
  const rows = await db.select({ id: players.id }).from(players);
  return rows.map((r) => ({ id: String(r.id) }));
}

/**
 * Pase de rendimiento (2026-09-14): esta página lee `searchParams` (year/tier), y en
 * esta versión de Next.js leer `searchParams` fuerza SSR dinámico SIN caché en
 * absoluto, con independencia del `export const revalidate` de arriba — confirmado
 * midiendo contra un build de producción real (repetir la misma URL daba ~1-2s cada
 * vez, nunca una respuesta servida de caché). `/players/[id]` era, con diferencia, la
 * ruta más cara de todo el sitio en Vercel Observability (29s de CPU activa en 12h,
 * más que las siguientes 4 rutas juntas).
 *
 * NO usar `unstable_cache` aquí — mismo bug real ya confirmado en `/rankings` (ver el
 * comentario de `getRankingsPageData` en app/rankings/page.tsx), reproducido aquí en
 * una auditoría de rendimiento (2026-09-19): esta función recibe varios argumentos
 * (`playerId`, `year`, `tier`), justo la forma que ya se demostró que puede quedarse
 * sirviendo un resultado equivocado de forma indefinida en esta versión de Next.js —
 * aquí sería aún peor que en rankings, podría enseñar los datos de OTRO jugador en
 * esta URL. Como esta página ya es SSR dinámico sin caché de todas formas por leer
 * `searchParams` (ver el párrafo de arriba), quitar `unstable_cache` no cambia el
 * perfil de rendimiento del HTML servido — solo se deja de deduplicar la consulta a
 * la base de datos entre visitas con la misma combinación de `(playerId, year, tier)`.
 *
 * Devuelve solo datos planos (nunca JSX ni componentes) — herencia de cuando esto sí
 * pasaba por `unstable_cache` (que exige poder pasar el resultado por
 * `JSON.stringify`/`JSON.parse`), y se mantiene así a propósito: es una interfaz más
 * limpia entre la carga de datos y el JSX, con independencia de si hay caché en medio.
 */
async function getPlayerPageData<T>(
  playerId: number,
  requestedYear: string | undefined,
  requestedTier: string | undefined,
  withPlayer: (linkedUserId: string | null) => Promise<T>,
) {
  // Sin `avatarUrl` (bug real encontrado al probar el pase de "Latest" en la ficha,
  // 2026-09-16) — puede ser un data URI en base64 cuando el jugador subió su propia
  // foto (avatarIsCustom), y `unstable_cache` serializa TODO el resultado con
  // `JSON.stringify` antes de guardarlo: para más de un jugador ya real, esa foto por
  // sí sola hacía que el payload entero superara el límite de 2MB por entrada de
  // Next.js, y la caché fallaba en SILENCIO en cada visita ("items over 2MB can not
  // be cached", solo en el log del servidor) — la propia optimización que existe
  // esta función para dar (evitar repetir ~10 consultas caras) quedaba anulada del
  // todo para cualquier jugador con una foto grande. Se pide aparte, sin pasar por
  // esta caché, más abajo en `PlayerPage` (una fila por clave primaria, barata de
  // sobra para no necesitar cachearse).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { avatarUrl: _avatarUrl, ...playerColumnsWithoutAvatar } = getTableColumns(players);
  const currentYear = new Date().getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { originalScreenshotUrl: _originalScreenshotUrl, ...buildColumnsWithoutScreenshot } = getTableColumns(playerBuilds);

  // Todo lo que solo depende de `playerId`, en UNA tanda (pase de rendimiento,
  // 2026-10-11): antes la fila del jugador, luego noticias/vídeos y luego esto iban en
  // tres viajes seguidos a la BD. Para un id inexistente se hacen unas consultas de más
  // que no devuelven nada — raro, y mucho más barato que esperar a la fila primero.
  const [[player], playerNews, playerVideos, rankHistory, [bestRankWeekRow], careerStats, yearRows, palmares, builds, awardWins] = await Promise.all([
    db.select(playerColumnsWithoutAvatar).from(players).where(eq(players.id, playerId)),
    getNewsForPlayer(playerId),
    getVideosForPlayer(playerId),
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
    getPalmares(playerId),
    // TODAS las builds del jugador (hasta 3, lib/buildStats.ts::MAX_BUILDS_PER_PLAYER)
    // — pedido explícito: la ficha pública enseña cada build pública que tenga, no
    // solo la marcada "in use" (PlayerBuildCard ya filtra por `isPublic` y por si hay
    // algo que mostrar en cada una). Sin `originalScreenshotUrl` (pase de rendimiento,
    // 2026-09-13) — el propio schema ya documenta que PlayerBuildCard nunca lo lee,
    // solo pesa: es el screenshot completo tal cual se subió, en base64.
    db
      .select(buildColumnsWithoutScreenshot)
      .from(playerBuilds)
      .where(eq(playerBuilds.playerId, playerId)),
    getPlayerAwardWinsCached(playerId),
  ]);
  if (!player) return null;

  const availableYears = yearRows.map((r) => r.year);
  const requestedYearNum = Number(requestedYear);
  const selectedYear = availableYears.includes(requestedYearNum) ? requestedYearNum : (availableYears[0] ?? currentYear);
  const selectedTier: ActivityTier = ACTIVITY_TIERS.includes(requestedTier as ActivityTier)
    ? (requestedTier as ActivityTier)
    : "all";

  // Ids de los partidos de esa temporada como subconsulta, para pedir sets y vídeos en
  // la MISMA tanda que los partidos en vez de esperar a tener los ids (pase de
  // rendimiento, 2026-10-11). `withPlayer` (lo que la página necesita de la fila del
  // jugador: seguir, estadísticas sociales) también va en esta tanda.
  const seasonMatchIds = db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(editions, eq(matches.editionId, editions.id))
    .where(and(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)), eq(editions.year, selectedYear)));

  const [matchRows, byeRows, videoRows, setRows, extra] = await Promise.all([
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
    db
      .select({ matchId: matchVideos.matchId, youtubeVideoId: matchVideos.youtubeVideoId })
      .from(matchVideos)
      .where(and(inArray(matchVideos.matchId, seasonMatchIds), inArray(matchVideos.status, ["auto", "confirmed"]))),
    db
      .select({ matchId: sets.matchId, setNumber: sets.setNumber, winnerGames: sets.winnerGames, loserGames: sets.loserGames, tiebreakLoserPoints: sets.tiebreakLoserPoints })
      .from(sets)
      .where(inArray(sets.matchId, seasonMatchIds)),
    withPlayer(player.linkedUserId),
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
    // Se rellena de verdad fuera de esta caché, ver PlayerPage más abajo — el
    // comentario de arriba explica por qué no puede vivir aquí dentro.
    avatarUrl: null,
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

  return {
    player,
    playerNews,
    playerVideos,
    headerData,
    chartData,
    availableYears,
    selectedYear,
    selectedTier,
    filteredGroups,
    seasonWins,
    seasonLosses,
    seasonTitles,
    palmares,
    awardWins,
    builds,
    extra,
  };
}

/**
 * Todo lo que pinta la ficha (cabecera + pestañas). Se lanza desde `PlayerPage` SIN
 * esperarla y la esperan `PlayerTop` y `PlayerSections` (pase de rendimiento,
 * 2026-10-11): así el `Sidebar`, hermano de esos dos, carga sus widgets AL MISMO
 * TIEMPO. Antes la página esperaba todos sus datos antes de devolver el JSX, y el
 * sidebar no empezaba a consultar nada hasta entonces (~0,7 s más en cada visita).
 */
async function loadPlayerPage(playerId: number, requestedParams: { year?: string; tier?: string }) {
  // El visitante se pide en paralelo con todo lo demás; seguir y estadísticas sociales
  // van dentro de la segunda tanda de getPlayerPageData (necesitan la fila del jugador).
  const userPromise = getCurrentUser();
  const [data, [avatarRow]] = await Promise.all([
    getPlayerPageData(playerId, requestedParams.year, requestedParams.tier, async (linkedUserId) => {
      const viewer = await userPromise;
      return Promise.all([isFollowing(viewer?.id ?? null, "player", playerId), getPlayerSocialStats(playerId, linkedUserId)]);
    }),
    // Fuera de la caché a propósito — ver el comentario dentro de getPlayerPageData:
    // puede ser un data URI en base64 de varios MB, y eso rompía la caché entera para
    // cualquier jugador con una foto grande. Una fila por clave primaria es barata de
    // sobra sin necesitar cachearse.
    db.select({ avatarUrl: players.avatarUrl }).from(players).where(eq(players.id, playerId)),
    // También fuera de la caché a propósito — ver el comentario en components/players/
    // PlayerHeader.tsx: el estado de "sigo a este jugador" es por visitante. (Aquí
    // también para que un fallo se vea aunque el jugador no exista y nadie lo espere.)
    userPromise,
  ]);
  if (!data) notFound();
  const [following, socialStats] = data.extra;

  const {
    player,
    playerNews,
    playerVideos,
    headerData: headerDataWithoutAvatar,
    chartData,
    availableYears,
    selectedYear,
    selectedTier,
    filteredGroups,
    seasonWins,
    seasonLosses,
    seasonTitles,
    palmares,
    awardWins,
    builds,
  } = data;
  const headerData: PlayerHeaderData = { ...headerDataWithoutAvatar, avatarUrl: avatarRow?.avatarUrl ?? null };

  // Pestañas de la ficha pública — pedido explícito del propietario: "Tour profile
  // page is too long, divide it in apposite sections". Mismo SectionShell que ya
  // resolvía esto en /account, pero con `variant="tabs"` — pedido explícito aparte,
  // con una captura de referencia: la barra horizontal, no la columna lateral de
  // /account. Orden pedido explícito: Ranking & Activity justo después de Overview,
  // antes de Build. "Build" NO se omite nunca aunque no haya build pública: pedido
  // explícito, "the build button must always be available even with no builds on the
  // profile", así que esa pestaña se queda siempre y es PlayerBuildCard quien decide
  // su contenido (la propia build, o un aviso si no hay ninguna todavía).
  //
  // "Latest" tenía pestaña propia hasta este mismo pase — pedido explícito
  // (2026-09-17): "Player profiles shouldn't have a dedicated latest page, news
  // should just appear in overview, just smaller [and videos]". `CompactLatestList`
  // (components/news/LatestFeed.tsx) es esa versión reducida: unas pocas filas, sin
  // pestañas de filtro ni hero, directamente dentro de Overview.
  const latestItems = mergeChronologically(playerNews, playerVideos);
  const sections: ShellSection[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="flex flex-col gap-6">
          <PlayerFactsCard player={player} socialStats={socialStats} />
          <PlayerPalmares titles={palmares} />
          <PlayerAwards wins={awardWins} />
          {latestItems.length > 0 && (
            <div>
              <h2 className="text-headline mb-3 text-lg text-ink">Latest</h2>
              <CompactLatestList items={latestItems} />
            </div>
          )}
        </div>
      ),
    },
    {
      // Ranking + actividad, unidas — pedido explícito del propietario tras dividir la
      // ficha en pestañas: "unify ranking history and player activity" (eran dos
      // pestañas MUY relacionadas — la evolución del ranking y los partidos que la
      // explican — separarlas obligaba a saltar de una a otra para ver las dos caras
      // del mismo rendimiento).
      id: "activity",
      label: "Ranking & Activity",
      content: (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-rule bg-paper p-4 shadow-sm">
            <RankEvolutionChart data={chartData} />
          </div>
          <div>
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
        </div>
      ),
    },
    {
      id: "build",
      label: "Build",
      content: hasVisibleBuilds(builds) ? (
        <PlayerBuildCard builds={builds} />
      ) : (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
          {player.displayName} hasn&rsquo;t shared a public build yet.
        </p>
      ),
    },
  ];

  return { headerData, following, sections };
}

type PlayerPageContent = Awaited<ReturnType<typeof loadPlayerPage>>;

async function PlayerTop({ content, playerId }: { content: Promise<PlayerPageContent>; playerId: number }) {
  const { headerData, following } = await content;
  return (
    <PlayerHeader
      data={headerData}
      actions={
        <FollowButton
          targetType="player"
          targetId={playerId}
          initialFollowing={following}
          toggleAction={toggleFollow.bind(null, "player", playerId, `/players/${playerId}`)}
          onDarkSurface
        />
      }
    />
  );
}

async function PlayerSections({ content }: { content: Promise<PlayerPageContent> }) {
  const { sections } = await content;
  return <SectionShell sections={sections} variant="tabs" />;
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; tier?: string }>;
}) {
  preloadSidebar(["profile"]);
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();

  const content = loadPlayerPage(playerId, await searchParams);
  return (
    <div>
      <PlayerTop content={content} playerId={playerId} />
      <PlayerLiveBanner playerId={playerId} />
      <div className="tour-container pt-4 pb-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <PlayerSections content={content} />
        </div>
        <Sidebar hide={["profile"]} />
      </div>
    </div>
  );
}
