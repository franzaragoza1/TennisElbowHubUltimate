import { db } from "@/db/client";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { getLatestRankingWeek, getTopPlayers } from "@/lib/tourQueries";
import { getCareerStats } from "@/lib/h2hStats";
import { memoizeWithTtl } from "@/lib/memoCache";

const DASH = "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-rule py-1.5 last:border-0">
      <span className="text-eyebrow text-[11px] text-muted-label">{label}</span>
      <span className="tour-numeric text-headline text-sm text-ink">{value}</span>
    </div>
  );
}

/** Entre cuántos de los primeros puestos del ranking oficial se elige al sujeto —
 * pedido explícito: no siempre el mismo nº1, sino uno cualquiera del top 12. */
const FEATURED_POOL_SIZE = 12;

/** Sale en el sidebar de casi todas las páginas del sitio — pase de rendimiento,
 * 2026-09-14, mismo patrón que H2HWidget.tsx: la elección al azar se queda viva
 * (sin cachear), pero el conjunto de partida (top 12) y los datos por jugador
 * elegido (fila + `getCareerStats`) sí, por separado — antes eran 3 consultas
 * propias sin caché alguna en cada visita a cualquier página. */
const getFeaturedPlayerPool = unstable_cache(
  async () => {
    const week = await getLatestRankingWeek();
    return week ? getTopPlayers(week, FEATURED_POOL_SIZE) : [];
  },
  ["profile-widget-pool"],
  { revalidate: 600 },
);

// `memoizeWithTtl`, no `unstable_cache` — esta función recibe un argumento
// (`playerId`), la misma forma que ya se demostró que puede dejar a `unstable_cache`
// sirviendo indefinidamente el perfil de OTRO jugador en esta versión de Next.js (ver
// lib/memoCache.ts); este widget sale en el sidebar de casi todas las páginas del
// sitio y el ahorro de cachear por jugador es real y ya medido (ver el comentario de
// arriba), así que se sustituye en vez de eliminarse. Columnas explícitas, solo las
// 4 que de verdad se pintan (auditoría de rendimiento, 2026-09-19) — antes era
// `select()` sin más, arrastrando bio/redes/build y demás sin usarlas nunca aquí.
const getFeaturedPlayerData = memoizeWithTtl(async (playerId: number) => {
  // Fila y estadísticas en la misma tanda (pase de rendimiento, 2026-10-11).
  const [[player], stats] = await Promise.all([
    db
      .select({
        displayName: players.displayName,
        country: players.country,
        countryOverride: players.countryOverride,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .where(eq(players.id, playerId)),
    getCareerStats(playerId, new Date().getFullYear()),
  ]);
  if (!player) return null;
  return { player, stats };
}, 600_000);

/**
 * Sujeto: uno cualquiera de los primeros 12 del ranking oficial de la semana en
 * curso, elegido al azar en cada carga — no siempre el mismo (pedido explícito), pero
 * sin inventar una curación editorial: el conjunto de partida sigue siendo un dato
 * real (el top 12 tal cual), no una elección nuestra de "jugador destacado". Solo
 * enseña cifras que ya calculamos de verdad (`getCareerStats`, lib/h2hStats.ts) —
 * nada de 1er saque/aces/juegos de servicio ganados: esas vienen de `match_stats`,
 * una tabla que existe en el esquema pero no la rellena ni la lee nada en este
 * proyecto todavía.
 */
/** Sorteo + datos del jugador elegido, una vez por petición (`cache` de React): la
 * página puede lanzarlo al empezar (`preloadProfileWidget`, vía `preloadSidebar`) para
 * que corra en paralelo con sus propias consultas, y el widget recoge esa misma
 * promesa — el mismo jugador sorteado — al pintarse (pase de rendimiento, 2026-10-11). */
const loadProfileWidget = cache(async () => {
  const top = await getFeaturedPlayerPool();
  if (top.length === 0) return null;

  // Server Component: elección al azar pedida explícitamente (ver comentario de arriba),
  // se recalcula en cada request del servidor.
  const playerId = top[Math.floor(Math.random() * top.length)].playerId;
  const featured = await getFeaturedPlayerData(playerId);
  return featured ? { playerId, ...featured } : null;
});

export function preloadProfileWidget() {
  loadProfileWidget().catch(() => {});
}

export async function ProfileWidget() {
  const featured = await loadProfileWidget();
  if (!featured) return null;
  const { playerId, player, stats } = featured;

  return (
    <SidebarPanel title="PROFILE" href={`/players/${playerId}`} linkLabel="View all">
      <div className="mb-3 flex items-center gap-3">
        <PlayerAvatar displayName={player.displayName} country={player.countryOverride ?? player.country} avatarUrl={player.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-headline truncate text-lg text-ink">{player.displayName}</p>
          <p className="text-muted-label text-xs">{stats.currentRank ? `World No. ${stats.currentRank}` : "Unranked"}</p>
        </div>
      </div>
      <Stat label="Points" value={stats.currentPoints !== null ? stats.currentPoints.toLocaleString("en-US") : DASH} />
      <Stat label="Career high" value={stats.careerHigh !== null ? `#${stats.careerHigh}` : DASH} />
      <Stat label="Career W-L" value={`${stats.careerWins}-${stats.careerLosses}`} />
      <Stat label="Titles" value={String(stats.careerTitles)} />
    </SidebarPanel>
  );
}
