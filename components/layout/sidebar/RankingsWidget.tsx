import Link from "next/link";
import { unstable_cache } from "next/cache";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { getLatestRankingWeek, getTopPlayers } from "@/lib/tourQueries";

/** Sale en el sidebar de casi todas las páginas del sitio — pase de rendimiento,
 * 2026-09-14, mismo motivo que H2HWidget.tsx: sin caché, dos consultas propias en
 * cada visita a cualquier página, para un top 10 que no cambia hasta el próximo
 * ranking importado. */
const getRankingsWidgetData = unstable_cache(
  async () => {
    const week = await getLatestRankingWeek();
    return week ? getTopPlayers(week, 10) : [];
  },
  ["rankings-widget-data"],
  { revalidate: 600, tags: ["rankings"] },
);

export async function RankingsWidget() {
  const top = await getRankingsWidgetData();
  if (top.length === 0) return null;

  return (
    <SidebarPanel title="RANKINGS" href="/rankings" linkLabel="Full rankings">
      <ul className="space-y-2">
        {top.map((p) => (
          <li key={p.playerId}>
            {/* Sin prefetch (pase de rendimiento, 2026-09-14) — este widget sale en el
             * sidebar de casi todas las páginas del sitio, siempre con los mismos
             * jugadores; sin esto, cada visita a cualquier página precargaba de fondo
             * la ficha de cada uno de ellos. */}
            <Link href={`/players/${p.playerId}`} prefetch={false} className="flex items-center gap-2.5 hover:text-blue-500">
              <span className="tour-numeric text-headline w-4 shrink-0 text-right text-sm text-ink">{p.rank}</span>
              <PlayerAvatar displayName={p.displayName} country={p.country} avatarUrl={p.avatarUrl} />
              <span className="text-ink min-w-0 flex-1 truncate text-sm">{p.displayName}</span>
              <span className="tour-numeric text-muted-label shrink-0 text-xs">{p.points.toLocaleString("en-US")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SidebarPanel>
  );
}
