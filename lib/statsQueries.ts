/**
 * Leaderboards agregados sobre `match_stats` — solo tiene datos reales desde que
 * existe `lib/matchLog/*` (ver docs/decisiones.md, 2026-08-16: antes de eso la tabla
 * estaba completamente vacía). Los porcentajes se calculan sobre la SUMA de numerador
 * y denominador de todos los partidos de un jugador, nunca como media de sus
 * porcentajes partido a partido — es la forma correcta estadísticamente y es la misma
 * que usa la propia ATP.
 *
 * Estructura agrupada en tres categorías (Serve / Return / Under Pressure), como los
 * "Stats Leaderboards" reales de ATP. Cada una lleva un "Rating" de cabecera para
 * poder ordenar por una sola cifra (pedido explícito) — pero, a diferencia del de la
 * ATP (una fórmula propietaria suya, opaca, que no podemos ni queremos replicar), el
 * nuestro es la SUMA lisa y llana de los porcentajes reales que ya se enseñan en esa
 * misma tabla (ver `sumPct` más abajo): nunca esconde un número que el propio jugador
 * no pueda reconstruir a mano sumando las columnas que tiene delante. Columnas
 * de la referencia que no podemos construir sin adivinar (p.ej. "% Service Games Won"
 * necesitaría saber quién sacaba en cada juego, dato que el MatchLog no da) simplemente
 * no están, en vez de rellenarse con una aproximación inventada.
 *
 * Filtros (pedido explícito, replicando los desplegables reales de ATP): rival
 * ("Versus All/Top 10/20/50 Players"), periodo ("52 Weeks"/"Career"/año concreto) y
 * superficie (familia real, ver lib/surfaceColors.ts). Todo se filtra EN SQL, antes de
 * agregar — nunca se trae el universo entero y se recorta después como antes de que
 * existieran filtros, porque el propio filtro decide qué partidos cuentan en la suma.
 * El rango del rival es su ranking oficial de la semana MÁS CERCANA (en el pasado) a
 * la del propio partido — nunca su ranking de hoy: un partido de hace dos años contra
 * un entonces-Top 10 que ahora está retirado sigue siendo un partido contra un Top 10.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import type { SurfaceFamily } from "@/lib/surfaceColors";
import { DEFAULT_MY_STATS_WINDOW, type MyStatsWindow } from "@/lib/myStatsWindow";

/**
 * Mínimo de partidos con estadística registrada (ya filtrados) para entrar en un
 * leaderboard — sin esto, un jugador con un solo partido y un 100% real se colaría
 * por delante de quien lleva decenas de partidos con un 70% de verdad. Mismo espíritu
 * que el mínimo de partidos jugados de los Stats Leaders reales de la ATP — cifra
 * elegida a mano, fácil de ajustar si hace falta.
 */
const MIN_MATCHES = 5;

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

export interface StatsFilters {
  opponentTier: "all" | 10 | 20 | 50;
  period: "52w" | "career" | number; // number = año concreto
  surface: "all" | SurfaceFamily;
}

export const DEFAULT_STATS_FILTERS: StatsFilters = { opponentTier: "all", period: "52w", surface: "all" };

// Mismas familias y mismos patrones que lib/surfaceColors.ts::surfaceFamily — duplicado
// a propósito como regex de Postgres (`~*`) en vez de reutilizar esa función: aquella
// clasifica una superficie ya conocida en JS, esto filtra en SQL antes de traer nada.
const SURFACE_FAMILY_PATTERN: Record<SurfaceFamily, string> = {
  Clay: "clay",
  Grass: "grass",
  Carpet: "carpet",
  Hard: "concrete|cement|hard|synthetic",
};

function periodCondition(period: StatsFilters["period"]): SQL {
  if (period === "career") return sql`true`;
  if (period === "52w") return sql`e.week_start_date >= current_date - interval '52 weeks'`;
  return sql`e.year = ${period}`;
}

function surfaceCondition(surface: StatsFilters["surface"]): SQL {
  if (surface === "all") return sql`true`;
  return sql`e.surface ~* ${SURFACE_FAMILY_PATTERN[surface]}`;
}

function opponentTierCondition(tier: StatsFilters["opponentTier"]): SQL {
  if (tier === "all") return sql`true`;
  return sql`opp_rank.rank <= ${tier}`;
}

/**
 * Cláusula común a las tres consultas: partido de este jugador (`ms`), su edición
 * (`e`), y el rival vía la OTRA fila de `match_stats` del mismo partido (`om`) — ambos
 * jugadores de un partido con estadísticas siempre tienen su propia fila
 * (lib/matchLog/importMatchLog.ts inserta las dos juntas), así que este self-join
 * nunca deja fuera a nadie que de verdad tenga estadísticas. `opp_rank` es un LATERAL:
 * el ranking oficial del rival en la semana más cercana (nunca posterior) a la del
 * propio partido — `LEFT JOIN` a propósito, un partido de Finals (`e.iso_week` nulo) o
 * un rival sin ranking en ninguna semana anterior simplemente no calza con ningún
 * candidato, y la condición de rival se trata como "no aplica" (ver
 * `opponentTierCondition`), nunca como partido descartado del todo.
 */
function joinAndFilter(filters: StatsFilters): SQL {
  return sql`
    JOIN matches m ON m.id = ms.match_id
    JOIN editions e ON e.id = m.edition_id
    JOIN match_stats om ON om.match_id = ms.match_id AND om.player_id <> ms.player_id
    LEFT JOIN LATERAL (
      SELECT rs.rank
      FROM ranking_snapshots rs
      WHERE rs.player_id = om.player_id AND rs.kind = 'official'
        AND e.iso_week IS NOT NULL
        AND (rs.iso_year, rs.iso_week) <= (e.year, e.iso_week)
      ORDER BY rs.iso_year DESC, rs.iso_week DESC
      LIMIT 1
    ) opp_rank ON true
    WHERE ${periodCondition(filters.period)} AND ${surfaceCondition(filters.surface)} AND ${opponentTierCondition(filters.opponentTier)}
  `;
}

interface PlayerCols {
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  matchesCounted: number;
}

export interface ServeLeaderRow extends PlayerCols {
  serveRating: number;
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  acesPerMatch: number | null;
  doubleFaultsPerMatch: number | null;
  fastestServeKmh: number | null;
}

export interface ReturnLeaderRow extends PlayerCols {
  returnRating: number;
  returnPointsWonPct: number | null;
  breakPointsWonPct: number | null;
}

export interface PressureLeaderRow extends PlayerCols {
  pressureRating: number;
  breakPointsWonPct: number | null;
  breakPointsSavedPct: number | null;
  tiebreaksWonPct: number | null;
}

/** Suma de porcentajes reales, cero cuando falta alguno — nunca `null`, así que
 * siempre hay por dónde ordenar (a diferencia de una columna individual, que sí puede
 * faltar). `Rating` es la cabecera de la tabla, no puede quedarse en blanco. */
function sumPct(...values: (number | null)[]): number {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0);
}

interface ServeRow {
  player_id: number;
  display_name: string;
  country: string | null;
  character: string | null;
  avatar_url: string | null;
  matches_counted: number;
  first_serve_pct: number | null;
  first_serve_won_pct: number | null;
  second_serve_won_pct: number | null;
  aces_per_match: number | null;
  double_faults_per_match: number | null;
  fastest_serve_kmh: number | null;
}

export async function getServeLeaders(limit: number, filters: StatsFilters = DEFAULT_STATS_FILTERS): Promise<ServeLeaderRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id AS player_id, p.display_name, coalesce(p.country_override, p.country) AS country, p.character, p.avatar_url,
      count(*)::int AS matches_counted,
      round(100.0 * sum(ms.first_serve_in) / nullif(sum(ms.first_serve_attempted), 0), 1)::float8 AS first_serve_pct,
      round(100.0 * sum(ms.first_serve_points_won) / nullif(sum(ms.first_serve_points_played), 0), 1)::float8 AS first_serve_won_pct,
      round(100.0 * sum(ms.second_serve_points_won) / nullif(sum(ms.second_serve_points_played), 0), 1)::float8 AS second_serve_won_pct,
      round(sum(ms.aces)::numeric / count(*), 1)::float8 AS aces_per_match,
      round(sum(ms.double_faults)::numeric / count(*), 1)::float8 AS double_faults_per_match,
      max(ms.fastest_serve_kmh) AS fastest_serve_kmh
    FROM match_stats ms
    JOIN players p ON p.id = ms.player_id
    ${joinAndFilter(filters)}
    GROUP BY p.id
    HAVING count(*) >= ${MIN_MATCHES}
  `);
  const rows = rowsOf<ServeRow>(result);

  // Sin LIMIT en SQL a propósito: el Rating se calcula EN JS a partir de columnas ya
  // traídas (ver sumPct arriba), así que recortar antes podría dejar fuera a alguien
  // que solo destaca en el Rating combinado, no en ningún percentil individual. El
  // universo entero de jugadores con datos es de unos cientos (CLAUDE.md §1), así que
  // traerlo entero y recortar después es barato.
  return rows
    .map((r) => ({
      playerId: r.player_id,
      displayName: r.display_name,
      country: r.country,
      character: r.character,
      avatarUrl: r.avatar_url,
      matchesCounted: r.matches_counted,
      firstServePct: r.first_serve_pct,
      firstServeWonPct: r.first_serve_won_pct,
      secondServeWonPct: r.second_serve_won_pct,
      acesPerMatch: r.aces_per_match,
      doubleFaultsPerMatch: r.double_faults_per_match,
      fastestServeKmh: r.fastest_serve_kmh,
      serveRating: sumPct(r.first_serve_pct, r.first_serve_won_pct, r.second_serve_won_pct),
    }))
    .sort((a, b) => b.serveRating - a.serveRating)
    .slice(0, limit);
}

interface ReturnRow {
  player_id: number;
  display_name: string;
  country: string | null;
  character: string | null;
  avatar_url: string | null;
  matches_counted: number;
  return_points_won_pct: number | null;
  break_points_won_pct: number | null;
}

export async function getReturnLeaders(limit: number, filters: StatsFilters = DEFAULT_STATS_FILTERS): Promise<ReturnLeaderRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.id AS player_id, p.display_name, coalesce(p.country_override, p.country) AS country, p.character, p.avatar_url,
      count(*)::int AS matches_counted,
      round(100.0 * sum(ms.return_points_won) / nullif(sum(ms.return_points_played), 0), 1)::float8 AS return_points_won_pct,
      round(100.0 * sum(ms.break_points_won) / nullif(sum(ms.break_points_faced), 0), 1)::float8 AS break_points_won_pct
    FROM match_stats ms
    JOIN players p ON p.id = ms.player_id
    ${joinAndFilter(filters)}
    GROUP BY p.id
    HAVING count(*) >= ${MIN_MATCHES}
  `);
  const rows = rowsOf<ReturnRow>(result);

  return rows
    .map((r) => ({
      playerId: r.player_id,
      displayName: r.display_name,
      country: r.country,
      character: r.character,
      avatarUrl: r.avatar_url,
      matchesCounted: r.matches_counted,
      returnPointsWonPct: r.return_points_won_pct,
      breakPointsWonPct: r.break_points_won_pct,
      returnRating: sumPct(r.return_points_won_pct, r.break_points_won_pct),
    }))
    .sort((a, b) => b.returnRating - a.returnRating)
    .slice(0, limit);
}

interface PressureRow {
  player_id: number;
  display_name: string;
  country: string | null;
  character: string | null;
  avatar_url: string | null;
  matches_counted: number;
  break_points_won_pct: number | null;
  break_points_saved_pct: number | null;
}

interface TiebreakRow {
  player_id: number;
  tiebreaks_played: number;
  tiebreaks_won: number;
}

/**
 * Solo de partidos con MatchLog real (pedido explícito de bradut en Discord: "add
 * Tiebreaks won % (won/total) in all the matches from match logs") — de ahí el CTE
 * arrancando en `match_stats`, no en `matches`/`sets` directamente, que traería
 * también partidos sin ninguna estadística subida. Consulta APARTE de la de arriba a
 * propósito: unir `sets` (varias filas por partido) a la fila de `match_stats` de
 * este jugador multiplicaría cada suma de esa consulta por el número de sets del
 * partido, corrompiendo el resto de columnas de presión — así que primero se reduce a
 * la lista (jugador, partido, quién ganó el partido) ya filtrada por
 * `joinAndFilter`, y SOLO esa se une a `sets`.
 *
 * `sets.winnerGames`/`loserGames` están siempre en perspectiva del GANADOR DEL
 * PARTIDO (no de quien ganó ese set concreto) — de ahí comprobar contra
 * `sm.winner_id` para saber, set a set, si de verdad fue este jugador quien se llevó
 * el tie-break, sea cual sea el resultado final del partido.
 */
async function getTiebreakStats(filters: StatsFilters): Promise<Map<number, { played: number; won: number }>> {
  const result = await db.execute(sql`
    WITH scoped_matches AS (
      SELECT DISTINCT ms.player_id, ms.match_id, m.winner_id
      FROM match_stats ms
      ${joinAndFilter(filters)}
    )
    SELECT
      sm.player_id,
      count(*) FILTER (WHERE s.tiebreak_loser_points IS NOT NULL)::int AS tiebreaks_played,
      count(*) FILTER (
        WHERE s.tiebreak_loser_points IS NOT NULL AND (
          (sm.winner_id = sm.player_id AND s.winner_games > s.loser_games) OR
          (sm.winner_id <> sm.player_id AND s.winner_games < s.loser_games)
        )
      )::int AS tiebreaks_won
    FROM scoped_matches sm
    JOIN sets s ON s.match_id = sm.match_id
    GROUP BY sm.player_id
  `);
  const map = new Map<number, { played: number; won: number }>();
  for (const r of rowsOf<TiebreakRow>(result)) {
    map.set(r.player_id, { played: r.tiebreaks_played, won: r.tiebreaks_won });
  }
  return map;
}

/**
 * "Break points saved" (de cara al saque) no es una columna propia de `match_stats` —
 * el MatchLog solo da "break points won" desde el punto de vista de quien resta (ver
 * db/schema.ts). Pero esa misma fila, leída desde el lado del RIVAL en ese partido, ES
 * exactamente "puntos de rotura enfrentados/salvados al saque" de este jugador — se
 * deriva de `om` (la fila de estadísticas del rival), el mismo self-join que ya hace
 * falta para el ranking del rival en `joinAndFilter`, dato real, nunca inventado.
 */
export async function getPressureLeaders(limit: number, filters: StatsFilters = DEFAULT_STATS_FILTERS): Promise<PressureLeaderRow[]> {
  const [result, tiebreaks] = await Promise.all([
    db.execute(sql`
      SELECT
        p.id AS player_id, p.display_name, coalesce(p.country_override, p.country) AS country, p.character, p.avatar_url,
        count(*)::int AS matches_counted,
        round(100.0 * sum(ms.break_points_won) / nullif(sum(ms.break_points_faced), 0), 1)::float8 AS break_points_won_pct,
        round(100.0 * (sum(om.break_points_faced) - sum(om.break_points_won)) / nullif(sum(om.break_points_faced), 0), 1)::float8 AS break_points_saved_pct
      FROM match_stats ms
      JOIN players p ON p.id = ms.player_id
      ${joinAndFilter(filters)}
      GROUP BY p.id
      HAVING count(*) >= ${MIN_MATCHES}
    `),
    getTiebreakStats(filters),
  ]);
  const rows = rowsOf<PressureRow>(result);

  return rows
    .map((r) => {
      const tb = tiebreaks.get(r.player_id);
      return {
        playerId: r.player_id,
        displayName: r.display_name,
        country: r.country,
        character: r.character,
        avatarUrl: r.avatar_url,
        matchesCounted: r.matches_counted,
        breakPointsWonPct: r.break_points_won_pct,
        breakPointsSavedPct: r.break_points_saved_pct,
        // Solo informativo (pedido explícito: "As additional info") — no entra en la
        // suma de `pressureRating`, igual que `acesPerMatch`/`fastestServeKmh` tampoco
        // entran en `serveRating` más abajo.
        tiebreaksWonPct: tb && tb.played > 0 ? Math.round((1000 * tb.won) / tb.played) / 10 : null,
        pressureRating: sumPct(r.break_points_saved_pct, r.break_points_won_pct),
      };
    })
    .sort((a, b) => b.pressureRating - a.pressureRating)
    .slice(0, limit);
}

export interface StatShowcaseRow {
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  rating: number;
}

export interface StatsShowcase {
  serve: StatShowcaseRow[];
  return: StatShowcaseRow[];
  pressure: StatShowcaseRow[];
}

/** Top N de cada categoría, en la forma mínima que necesita el escaparate de la home
 * (components/stats/StatsLeadersShowcase.tsx) — mismas tres consultas de arriba, solo
 * recortadas a las columnas comunes que ese componente pinta. Siempre sin filtros (el
 * escaparate no tiene desplegables, solo la vista de detalle los tiene). */
export async function getStatsShowcase(limit = 5): Promise<StatsShowcase> {
  const [serve, ret, pressure] = await Promise.all([getServeLeaders(limit), getReturnLeaders(limit), getPressureLeaders(limit)]);
  const pick = (r: PlayerCols, rating: number): StatShowcaseRow => ({
    playerId: r.playerId,
    displayName: r.displayName,
    country: r.country,
    character: r.character,
    avatarUrl: r.avatarUrl,
    rating,
  });
  return {
    serve: serve.map((r) => pick(r, r.serveRating)),
    return: ret.map((r) => pick(r, r.returnRating)),
    pressure: pressure.map((r) => pick(r, r.pressureRating)),
  };
}

export interface StatsFilterOptions {
  /** Años reales con al menos una fila de `match_stats` — nunca un catálogo fijo,
   * mismo criterio que `RankingFilters`'s `countries` (CLAUDE.md §6). Descendente. */
  years: number[];
  /** Familias de superficie reales presentes en partidos con estadística. */
  surfaces: SurfaceFamily[];
}

const SURFACE_FAMILY_ORDER: SurfaceFamily[] = ["Hard", "Clay", "Grass", "Carpet"];

export async function getStatsFilterOptions(): Promise<StatsFilterOptions> {
  const [yearRows, surfaceRows] = await Promise.all([
    db.execute(sql`
      SELECT DISTINCT e.year FROM match_stats ms JOIN matches m ON m.id = ms.match_id JOIN editions e ON e.id = m.edition_id
      ORDER BY e.year DESC
    `),
    db.execute(sql`
      SELECT DISTINCT e.surface FROM match_stats ms JOIN matches m ON m.id = ms.match_id JOIN editions e ON e.id = m.edition_id
      WHERE e.surface IS NOT NULL
    `),
  ]);

  const years = rowsOf<{ year: number }>(yearRows).map((r) => r.year);
  const presentSurfaces = new Set(
    rowsOf<{ surface: string }>(surfaceRows)
      .map((r) => SURFACE_FAMILY_ORDER.find((family) => new RegExp(SURFACE_FAMILY_PATTERN[family], "i").test(r.surface)))
      .filter((f): f is SurfaceFamily => f !== undefined),
  );

  return { years, surfaces: SURFACE_FAMILY_ORDER.filter((f) => presentSurfaces.has(f)) };
}

export interface MyRecentStats {
  window: MyStatsWindow;
  matchesPlayed: number;
  wins: number;
  losses: number;
  matchesWithStats: number;
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  acesPerMatch: number | null;
  doubleFaultsPerMatch: number | null;
  fastestServeKmh: number | null;
  returnPointsWonPct: number | null;
  breakPointsWonPct: number | null;
}

interface RecordRow {
  wins: number;
  losses: number;
  matches_played: number;
}

interface MyStatsRow {
  matches_with_stats: number;
  first_serve_pct: number | null;
  first_serve_won_pct: number | null;
  second_serve_won_pct: number | null;
  aces_per_match: number | null;
  double_faults_per_match: number | null;
  fastest_serve_kmh: number | null;
  return_points_won_pct: number | null;
  break_points_won_pct: number | null;
}

/**
 * Resumen personal de "cómo estoy jugando últimamente" para /account — a diferencia
 * de los leaderboards de arriba (comparan contra el resto del tour), esto es sobre UN
 * jugador solo, sin ranking ni filtros que elegir. El récord W/L sale directo de
 * `matches` (disponible aunque el jugador nunca haya subido un MatchLog); las
 * columnas de detalle (saque, resto...) solo existen para los partidos de esa misma
 * ventana que sí tienen estadística real subida — pedido explícito, "from match log
 * or not": se enseña lo que haya de cada tipo, nunca se inventa lo que falta.
 */
export function myStatsWindowCondition(window: MyStatsWindow): SQL {
  // Parametrizado de verdad (nunca texto crudo interpolado): multiplicar un intervalo
  // de 1 día por un entero es sintaxis normal de Postgres.
  return window === "career" ? sql`true` : sql`e.week_start_date >= current_date - (interval '1 day' * ${window})`;
}

export async function getMyRecentStats(playerId: number, window: MyStatsWindow = DEFAULT_MY_STATS_WINDOW): Promise<MyRecentStats> {
  const windowCondition = myStatsWindowCondition(window);

  const [recordResult, statsResult] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE m.winner_id = ${playerId} AND m.outcome <> 'walkover')::int AS wins,
        count(*) FILTER (WHERE m.winner_id IS NOT NULL AND m.winner_id <> ${playerId} AND m.outcome <> 'walkover')::int AS losses,
        count(*)::int AS matches_played
      FROM matches m
      JOIN editions e ON e.id = m.edition_id
      WHERE (m.player1_id = ${playerId} OR m.player2_id = ${playerId})
        AND ${windowCondition}
    `),
    db.execute(sql`
      SELECT
        count(*)::int AS matches_with_stats,
        round(100.0 * sum(ms.first_serve_in) / nullif(sum(ms.first_serve_attempted), 0), 1)::float8 AS first_serve_pct,
        round(100.0 * sum(ms.first_serve_points_won) / nullif(sum(ms.first_serve_points_played), 0), 1)::float8 AS first_serve_won_pct,
        round(100.0 * sum(ms.second_serve_points_won) / nullif(sum(ms.second_serve_points_played), 0), 1)::float8 AS second_serve_won_pct,
        round(sum(ms.aces)::numeric / count(*), 1)::float8 AS aces_per_match,
        round(sum(ms.double_faults)::numeric / count(*), 1)::float8 AS double_faults_per_match,
        max(ms.fastest_serve_kmh) AS fastest_serve_kmh,
        round(100.0 * sum(ms.return_points_won) / nullif(sum(ms.return_points_played), 0), 1)::float8 AS return_points_won_pct,
        round(100.0 * sum(ms.break_points_won) / nullif(sum(ms.break_points_faced), 0), 1)::float8 AS break_points_won_pct
      FROM match_stats ms
      JOIN matches m ON m.id = ms.match_id
      JOIN editions e ON e.id = m.edition_id
      WHERE ms.player_id = ${playerId} AND ${windowCondition}
    `),
  ]);

  const record = rowsOf<RecordRow>(recordResult)[0];
  const stats = rowsOf<MyStatsRow>(statsResult)[0];

  return {
    window,
    matchesPlayed: Number(record?.matches_played ?? 0),
    wins: Number(record?.wins ?? 0),
    losses: Number(record?.losses ?? 0),
    matchesWithStats: Number(stats?.matches_with_stats ?? 0),
    firstServePct: stats?.first_serve_pct ?? null,
    firstServeWonPct: stats?.first_serve_won_pct ?? null,
    secondServeWonPct: stats?.second_serve_won_pct ?? null,
    acesPerMatch: stats?.aces_per_match ?? null,
    doubleFaultsPerMatch: stats?.double_faults_per_match ?? null,
    fastestServeKmh: stats?.fastest_serve_kmh ?? null,
    returnPointsWonPct: stats?.return_points_won_pct ?? null,
    breakPointsWonPct: stats?.break_points_won_pct ?? null,
  };
}
