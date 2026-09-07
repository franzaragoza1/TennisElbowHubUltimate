import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatGroupTabs, type StatGroup } from "@/components/stats/StatGroupTabs";
import { LeadersTable, type LeaderColumn } from "@/components/stats/LeadersTable";
import { StatsLeadersShowcase } from "@/components/stats/StatsLeadersShowcase";
import { StatsFilters } from "@/components/stats/StatsFilters";
import {
  getServeLeaders,
  getReturnLeaders,
  getPressureLeaders,
  getStatsShowcase,
  getStatsFilterOptions,
  DEFAULT_STATS_FILTERS,
  type ServeLeaderRow,
  type ReturnLeaderRow,
  type PressureLeaderRow,
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
  { key: "firstServePct", label: "1st Serve %", kind: "pct" },
  { key: "firstServeWonPct", label: "1st Serve Won %", kind: "pct" },
  { key: "secondServeWonPct", label: "2nd Serve Won %", kind: "pct" },
  { key: "acesPerMatch", label: "Aces/Match", kind: "count" },
  { key: "doubleFaultsPerMatch", label: "DF/Match", kind: "count" },
  { key: "fastestServeKmh", label: "Fastest Serve", kind: "speed" },
];

const RETURN_COLUMNS: LeaderColumn<ReturnLeaderRow>[] = [
  { key: "returnRating", label: "Return Rating", kind: "rating" },
  { key: "returnPointsWonPct", label: "Return Points Won %", kind: "pct" },
  { key: "breakPointsWonPct", label: "Break Points Won %", kind: "pct" },
];

const PRESSURE_COLUMNS: LeaderColumn<PressureLeaderRow>[] = [
  { key: "pressureRating", label: "Under Pressure Rating", kind: "rating" },
  { key: "breakPointsSavedPct", label: "Break Points Saved %", kind: "pct" },
  { key: "breakPointsWonPct", label: "Break Points Won %", kind: "pct" },
];

function isStatGroup(value: string | undefined): value is StatGroup {
  return value === "serve" || value === "return" || value === "pressure";
}

type GroupData =
  | { group: "serve"; rows: ServeLeaderRow[] }
  | { group: "return"; rows: ReturnLeaderRow[] }
  | { group: "pressure"; rows: PressureLeaderRow[] };

async function loadGroupData(group: StatGroup, filters: StatsFiltersValue): Promise<GroupData> {
  if (group === "serve") return { group, rows: await getServeLeaders(LIMIT, filters) };
  if (group === "return") return { group, rows: await getReturnLeaders(LIMIT, filters) };
  return { group, rows: await getPressureLeaders(LIMIT, filters) };
}

const TIER_VALUES = [10, 20, 50] as const;

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

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; tier?: string; period?: string; surface?: string }>;
}) {
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
    const showcase = await getStatsShowcase(5);
    const hasAnyData = showcase.serve.length > 0 || showcase.return.length > 0 || showcase.pressure.length > 0;

    return (
      <div>
        <PageMasthead
          eyebrow="Tennis Elbow 4 Online Tour"
          title="Stats Leaders"
          subtitle="Real per-match stats, backfilled from players' own TE4 match logs — only for matches already recorded as part of the tour."
        />
        <div className="tour-container py-8">
          {hasAnyData ? (
            <StatsLeadersShowcase serve={showcase.serve} returnLeaders={showcase.return} pressure={showcase.pressure} />
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
  const filterOptions = await getStatsFilterOptions();
  const filters = parseFilters(params, filterOptions);
  const data = await loadGroupData(group, filters);

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Stats Leaders"
        subtitle="Real per-match stats, backfilled from players' own TE4 match logs — only for matches already recorded as part of the tour."
      />
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="mb-4">
            <StatGroupTabs current={group} />
          </div>
          <StatsFilters
            years={filterOptions.years}
            surfaces={filterOptions.surfaces}
            currentTier={filters.opponentTier}
            currentPeriod={filters.period}
            currentSurface={filters.surface}
          />
          {data.group === "serve" && <LeadersTable rows={data.rows} columns={SERVE_COLUMNS} defaultSortKey="serveRating" />}
          {data.group === "return" && <LeadersTable rows={data.rows} columns={RETURN_COLUMNS} defaultSortKey="returnRating" />}
          {data.group === "pressure" && <LeadersTable rows={data.rows} columns={PRESSURE_COLUMNS} defaultSortKey="pressureRating" />}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
