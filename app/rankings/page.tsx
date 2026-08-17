import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { players, rankingSnapshots } from "@/db/schema";
import { RankingTable, type RankingRow } from "@/components/rankings/RankingTable";
import { RankingFilters, type RankedWeek } from "@/components/rankings/RankingFilters";
import { RankingViewToggle, type RankingView } from "@/components/rankings/RankingViewToggle";
import { LiveRankingToggle } from "@/components/rankings/LiveRankingToggle";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { getNextGenRaceRanking, getPlayerTotals, getYearRecords, type RankedPlayer } from "@/lib/tourQueries";
import { getLiveRanking } from "@/lib/liveRanking/liveRanking";

/** Cuando el ranking en vivo está activo, hay que reordenar por puntos en vivo sobre
 * TODOS los jugadores (no solo el top N pedido) — recortar antes de reordenar dejaría
 * fuera a quien suba de puesto por el torneo en curso. "Todos" en la práctica son
 * unos cientos de jugadores (CLAUDE.md §1), así que un límite alto en vez de sin
 * límite es seguro y sigue el mismo patrón ya usado en app/players/page.tsx. */
const FULL_UNIVERSE_LIMIT = 10000;

export const revalidate = 3600;

const DEFAULT_TOP_N = 100;
const TOP_N_OPTIONS = [50, 100, 200, 500];

async function getAvailableWeeks(kind: "official" | "race"): Promise<RankedWeek[]> {
  return db
    .selectDistinct({ isoYear: rankingSnapshots.isoYear, isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.kind, kind))
    .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek));
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; top?: string; view?: string; live?: string }>;
}) {
  const params = await searchParams;
  const view: RankingView =
    params.view === "race" ? "race" : params.view === "nextgen" ? "nextgen" : "official";
  // Next Gen Race es un filtro sobre la Race, no un `kind` propio en base de datos —
  // comparte su calendario de semanas (solo la más reciente, ver docs/decisiones.md).
  const weeks = await getAvailableWeeks(view === "official" ? "official" : "race");

  const topN = Math.min(500, Math.max(10, Number(params.top) || DEFAULT_TOP_N));

  let tableRows: RankingRow[] = [];
  let isoYear = 0;
  let isoWeek = 0;
  // Ver en vivo un torneo en curso solo tiene sentido sobre la semana más reciente —
  // el torneo "en curso ahora mismo" no tiene nada que ver con una semana antigua ya
  // cerrada, así que el toggle ni se ofrece fuera de ahí (pedido explícito).
  let isLatestWeek = false;
  if (weeks.length > 0) {
    isoYear = weeks[0].isoYear;
    isoWeek = weeks[0].isoWeek;
    isLatestWeek = true;
    // La Race (y Next Gen Race, que la reusa) solo se enseña en su semana más
    // reciente — no tiene el valor histórico de la oficial, así que ni se lee el
    // parámetro `week` para ninguna de las dos.
    if (view === "official" && params.week) {
      const [y, w] = params.week.split("-").map(Number);
      if (weeks.some((week) => week.isoYear === y && week.isoWeek === w)) {
        isoYear = y;
        isoWeek = w;
        isLatestWeek = y === weeks[0].isoYear && w === weeks[0].isoWeek;
      }
    }
  }
  // La Race (y Next Gen) son siempre en vivo, sin toggle (pedido explícito) — la
  // Oficial arranca apagada y el toggle la controla, pero solo cuando se está viendo
  // la semana más reciente (si no, `live=1` residual en la URL se ignora sin más).
  const isLive = view === "official" ? params.live === "1" && isLatestWeek : true;

  if (weeks.length > 0) {
    const fetchLimit = isLive ? FULL_UNIVERSE_LIMIT : topN;
    const [rows, totals, yearRecords] = await Promise.all([
      view === "nextgen"
        ? getNextGenRaceRanking(fetchLimit)
        : db
            .select({
              rank: rankingSnapshots.rank,
              points: rankingSnapshots.points,
              moved: rankingSnapshots.moved,
              playerId: players.id,
              displayName: players.displayName,
              country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
              character: players.character,
            })
            .from(rankingSnapshots)
            .innerJoin(players, eq(players.id, rankingSnapshots.playerId))
            .where(
              and(
                eq(rankingSnapshots.kind, view),
                eq(rankingSnapshots.isoYear, isoYear),
                eq(rankingSnapshots.isoWeek, isoWeek),
              ),
            )
            .orderBy(asc(rankingSnapshots.rank))
            .limit(fetchLimit),
      getPlayerTotals(),
      getYearRecords(isoYear),
    ]);

    // Puntos en vivo sobre el universo completo, reordenado y recortado a topN
    // DESPUÉS del reordenamiento — así un jugador que sube de puesto por el torneo en
    // curso puede entrar en el recorte, no solo quien ya estaba dentro del top N
    // oficial de partida.
    const liveRows: (RankedPlayer & { livePoints?: number; pointsDelta?: number; currentTournament?: { tournamentName: string; sentence: string } | null })[] =
      isLive ? (await getLiveRanking(view === "official" ? "official" : "race", rows)).slice(0, topN) : rows;

    tableRows = liveRows.map((r) => {
      const t = totals.get(r.playerId);
      const y = yearRecords.get(r.playerId);
      return {
        ...r,
        careerHigh: t?.careerHigh ?? null,
        // Títulos del año en curso (misma temporada que W-L), no de toda la carrera —
        // pedido explícito: en la tabla de rankings la columna "Titles" acompaña al
        // balance de la temporada, no al histórico completo (ese vive en la ficha del
        // jugador).
        titles: y?.titles ?? 0,
        yearWins: y?.wins ?? 0,
        yearLosses: y?.losses ?? 0,
      };
    });
  }

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Rankings"
        subtitle={
          view === "official"
            ? "Singles · Entry points, imported from the Mana Games Online Tour"
            : view === "race"
              ? "Singles · Points earned this season only, current week — decides who plays the Tour Finals"
              : "Singles · Race points, current week — players with no matches on record before this season"
        }
      />
      {/* El sidebar (320px + espacio) siempre se lleva parte del ancho ahora — el
       * límite "medium" (1000px) que tenía esta página se pensó para la tabla sola y
       * dejaba muy poco margen a la columna de jugador una vez restado el sidebar
       * (medido: ~80px, el nombre no cabía). Ancho normal del sitio (1200px) en los
       * dos modos; en vivo, `RankingTable` suelta High/W-L/Titles y usa columnas más
       * estrechas para caber sin scroll horizontal — ver docs/decisiones.md. */}
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-4">
            <RankingViewToggle current={view} extraParams={{ week: params.week, top: params.top }} />
          </div>

          {weeks.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
              {view === "official"
                ? "No ranking data loaded yet."
                : "No Race ranking imported yet — see docs/decisiones.md for how to backfill it."}
            </p>
          ) : view === "nextgen" && tableRows.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
              No debutants in this week&apos;s Race — everyone ranked already has a match on record from a previous season.
            </p>
          ) : (
            <>
              <RankingFilters
                weeks={weeks}
                currentWeek={{ isoYear, isoWeek }}
                currentTop={topN}
                topOptions={TOP_N_OPTIONS}
                showWeekPicker={view === "official"}
              >
                {(view !== "official" || isLatestWeek) && (
                  <LiveRankingToggle view={view} isLive={isLive} extraParams={{ week: params.week, top: params.top }} />
                )}
              </RankingFilters>
              <RankingTable rows={tableRows} highlightFinalsCutoff={view === "race"} isLive={isLive} />
            </>
          )}
        </div>
        <Sidebar hide={["rankings"]} />
      </div>
    </div>
  );
}
