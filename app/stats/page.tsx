import { unstable_cache } from "next/cache";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { preloadSidebar, Sidebar } from "@/components/layout/Sidebar";
import { StatGroupTabs } from "@/components/stats/StatGroupTabs";
import { StatGroupNote } from "@/components/stats/StatGroupNote";
import { isStatGroup, statGroupInfo, type StatGroup } from "@/lib/statGroups";
import { LeadersTable, type LeaderColumn } from "@/components/stats/LeadersTable";
import { StatsLeadersShowcase } from "@/components/stats/StatsLeadersShowcase";
import { StatsFilters } from "@/components/stats/StatsFilters";
import {
  getServeLeaders,
  getReturnLeaders,
  getPressureLeaders,
  getShotmakingLeaders,
  getStatsShowcase,
  getStatsFilterOptions,
  DEFAULT_STATS_FILTERS,
  type ServeLeaderRow,
  type ReturnLeaderRow,
  type PressureLeaderRow,
  type ShotmakingLeaderRow,
  type StatsFilters as StatsFiltersValue,
} from "@/lib/statsQueries";
import type { SurfaceFamily } from "@/lib/surfaceColors";

export const revalidate = 3600;

const LIMIT = 100;

// Solo datos planos (nunca funciones) — ver el comentario en LeadersTable.tsx: esto
// cruza de un Server Component (esta página) a un Client Component, y una función no
// sobrevive ese cruce.
// "Rating" es siempre la primera columna y el orden por defecto — suma lisa y llana
// de los porcentajes reales de esa misma tabla, nunca una fórmula opaca (ver
// lib/statsQueries.ts). Se pinta más grande (LeadersTable.tsx) para que quede claro
// que es la cifra de cabecera, igual que en la referencia.
const SERVE_COLUMNS: LeaderColumn<ServeLeaderRow>[] = [
  { key: "serveRating", label: "Serve Rating", kind: "rating" },
  { key: "serveRatingRaw", label: "Unadjusted Rating", kind: "decimal" },
  { key: "firstServePct", label: "1st Serve %", kind: "pct" },
  { key: "firstServeWonPct", label: "1st Serve Won %", kind: "pct" },
  { key: "secondServeWonPct", label: "2nd Serve Won %", kind: "pct" },
  { key: "acesPerMatch", label: "Aces / Match", kind: "decimal" },
  { key: "doubleFaultsPerMatch", label: "Double Faults / Match", kind: "decimal", lowerIsBetter: true },
  { key: "avgFirstServeKmh", label: "Avg 1st Serve", kind: "speed" },
  { key: "fastestServeKmh", label: "Fastest Serve", kind: "speed" },
];

const RETURN_COLUMNS: LeaderColumn<ReturnLeaderRow>[] = [
  { key: "returnRating", label: "Return Rating", kind: "rating" },
  { key: "returnRatingRaw", label: "Unadjusted Rating", kind: "decimal" },
  { key: "firstServeReturnWonPct", label: "1st Serve Return Won %", kind: "pct" },
  { key: "secondServeReturnWonPct", label: "2nd Serve Return Won %", kind: "pct" },
  { key: "breakPointsWonPct", label: "Break Points Converted %", kind: "pct" },
  { key: "returnPointsWonPct", label: "Return Points Won %", kind: "pct" },
];

const PRESSURE_COLUMNS: LeaderColumn<PressureLeaderRow>[] = [
  { key: "pressureRating", label: "Under Pressure Rating", kind: "rating" },
  { key: "pressureRatingRaw", label: "Unadjusted Rating", kind: "decimal" },
  { key: "breakPointsWonPct", label: "Break Points Converted %", kind: "pct" },
  { key: "breakPointsSavedPct", label: "Break Points Saved %", kind: "pct" },
  { key: "tiebreaksWonPct", label: "Tie-breaks Won %", kind: "pct" },
  { key: "decidingSetsWonPct", label: "Deciding Sets Won %", kind: "pct" },
];

const SHOTMAKING_COLUMNS: LeaderColumn<ShotmakingLeaderRow>[] = [
  { key: "pointsRating", label: "Points Won % (adjusted)", kind: "rating" },
  { key: "pointsWonPct", label: "Total Points Won %", kind: "pct" },
  { key: "netPointsWonPct", label: "Net Points Won %", kind: "pct" },
  { key: "winnersPerMatch", label: "Winners / Match", kind: "decimal" },
  { key: "unforcedErrorsPerMatch", label: "Unforced Errors / Match", kind: "decimal", lowerIsBetter: true },
  { key: "winnersToErrors", label: "Winners per Unforced Error", kind: "ratio" },
];

type GroupData =
  | { group: "serve"; rows: ServeLeaderRow[] }
  | { group: "return"; rows: ReturnLeaderRow[] }
  | { group: "pressure"; rows: PressureLeaderRow[] }
  | { group: "shotmaking"; rows: ShotmakingLeaderRow[] };

async function loadGroupData(group: StatGroup, filters: StatsFiltersValue): Promise<GroupData> {
  if (group === "serve") return { group, rows: await getServeLeaders(LIMIT, filters) };
  if (group === "return") return { group, rows: await getReturnLeaders(LIMIT, filters) };
  if (group === "pressure") return { group, rows: await getPressureLeaders(LIMIT, filters) };
  return { group, rows: await getShotmakingLeaders(LIMIT, filters) };
}

const TIER_VALUES = [10, 20, 50] as const;

/** Los filtros activos como query (`&tier=10&period=2026...`), para que cambiar de
 * categoría no los pierda. */
function filterQuery(params: { tier?: string; period?: string; surface?: string }): string {
  const q = new URLSearchParams();
  for (const key of ["tier", "period", "surface"] as const) {
    const v = params[key];
    if (v) q.set(key, v);
  }
  const text = q.toString();
  return text ? `&${text}` : "";
}

/** `52w` por defecto siempre — pedido explícito: la vista inicial de cada categoría
 * es la forma reciente, nunca la carrera entera de golpe (igual que ya hacía el
 * escaparate). El desplegable sigue dejando elegir "Career" o un año concreto. */
function parseFilters(params: { tier?: string; period?: string; surface?: string }, options: { years: number[]; surfaces: SurfaceFamily[] }): StatsFiltersValue {
  const tierNum = Number(params.tier);
  const opponentTier = TIER_VALUES.includes(tierNum as (typeof TIER_VALUES)[number]) ? (tierNum as 10 | 20 | 50) : "all";

  let period: StatsFiltersValue["period"] = DEFAULT_STATS_FILTERS.period;
  if (params.period === "career") period = "career";
  else if (params.period && options.years.includes(Number(params.period))) period = Number(params.period);

  const surface: StatsFiltersValue["surface"] =
    params.surface && options.surfaces.includes(params.surface as SurfaceFamily) ? (params.surface as SurfaceFamily) : "all";

  return { opponentTier, period, surface };
}

// Esta página lee `searchParams` (group/tier/period/surface) — igual que
// /players/[id], /rankings, /scores y /tournaments (mismo comentario en esas,
// 2026-09-14), eso fuerza SSR dinámico SIN caché en absoluto pese al `revalidate` de
// arriba. Dos cachés separadas porque la página tiene dos formas de datos bien
// distintas (portada vs. detalle por categoría) que nunca coexisten en la misma
// visita — cachear las dos como una sola función mezclaría formas de retorno sin
// necesidad.
const getStatsShowcaseData = unstable_cache(async () => getStatsShowcase(5), ["stats-showcase-data"], { revalidate: 3600 });

// NO usar `unstable_cache` aquí — mismo bug ya confirmado en `/rankings` y
// reproducido en `/players/[id]`/`/tournaments` (auditoría de rendimiento,
// 2026-09-19): esta función recibe CUATRO argumentos, la misma forma (y peor: más
// argumentos todavía) que ya se demostró que puede quedarse sirviendo un resultado
// equivocado de forma indefinida en esta versión de Next.js. Como la página ya es
// SSR dinámico sin caché de todas formas (ver el comentario de arriba), quitarlo no
// cambia el rendimiento del HTML servido.
async function getStatsGroupPageData(
  group: StatGroup,
  tierParam: string | undefined,
  periodParam: string | undefined,
  surfaceParam: string | undefined,
) {
  const filterOptions = await getStatsFilterOptions();
  const filters = parseFilters({ tier: tierParam, period: periodParam, surface: surfaceParam }, filterOptions);
  const data = await loadGroupData(group, filters);
  return { filterOptions, filters, data };
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; tier?: string; period?: string; surface?: string }>;
}) {
  preloadSidebar();
  const params = await searchParams;
  const hasGroup = isStatGroup(params.group);

  // Dos estados de la página, nunca los dos a la vez — el escaparate (con sus propias
  // cabeceras "SERVE LEADERS"/"RETURN LEADERS"/...) y la barra de pestañas de abajo
  // categorizan lo mismo; enseñar las dos juntas se leía como dos barras de
  // navegación superpuestas (pedido explícito: "no navbar in stats, just like the
  // rankings" — /rankings tampoco duplica su propio widget resumen dentro de sí
  // misma). Sin `?group=`, esta es la portada de /stats (el escaparate, como en la
  // home); en cuanto se elige una categoría (los botones "View all X Leaders" del
  // escaparate, o `/stats?group=...` directo), se enseña SOLO el detalle por pestañas.
  if (!hasGroup) {
    const showcase = await getStatsShowcaseData();
    const hasAnyData = showcase.serve.length > 0 || showcase.return.length > 0 || showcase.pressure.length > 0 || showcase.shotmaking.length > 0;

    return (
      <div>
        <PageMasthead
          eyebrow="Tennis Elbow 4 Online Tour"
          title="Stats Leaders"
          subtitle="Real per-match stats from players' own TE4 match logs, for matches recorded as part of the tour. Ratings follow the ATP's published formulas."
        />
        <div className="tour-container py-8">
          {hasAnyData ? (
            <StatsLeadersShowcase serve={showcase.serve} returnLeaders={showcase.return} pressure={showcase.pressure} shotmaking={showcase.shotmaking} />
          ) : (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
              No matches with recorded stats yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  const group = params.group as StatGroup;
  const { filterOptions, filters, data } = await getStatsGroupPageData(group, params.tier, params.period, params.surface);

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Stats Leaders"
        subtitle="Real per-match stats from players' own TE4 match logs, for matches recorded as part of the tour. Ratings follow the ATP's published formulas."
      />
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-4">
            <StatGroupTabs current={group} query={filterQuery(params)} />
          </div>
          <StatsFilters
            years={filterOptions.years}
            surfaces={filterOptions.surfaces}
            currentTier={filters.opponentTier}
            currentPeriod={filters.period}
            currentSurface={filters.surface}
          />
          <StatGroupNote group={statGroupInfo(group)} />
          {data.group === "serve" && <LeadersTable rows={data.rows} columns={SERVE_COLUMNS} defaultSortKey="serveRating" />}
          {data.group === "return" && <LeadersTable rows={data.rows} columns={RETURN_COLUMNS} defaultSortKey="returnRating" />}
          {data.group === "pressure" && <LeadersTable rows={data.rows} columns={PRESSURE_COLUMNS} defaultSortKey="pressureRating" />}
          {data.group === "shotmaking" && <LeadersTable rows={data.rows} columns={SHOTMAKING_COLUMNS} defaultSortKey="pointsRating" />}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
