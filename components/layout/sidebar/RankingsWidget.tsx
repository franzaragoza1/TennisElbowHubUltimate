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
      {/* Filas compactas (pase visual, 2026-10-11): avatar "xs" y fondo al pasar el
       * ratón en vez de solo cambiar el color del nombre. */}
      <ul className="-mx-2 space-y-0.5">
        {top.map((p) => (
          <li key={p.playerId}>
            {/* Sin prefetch (pase de rendimiento, 2026-09-14) — este widget sale en el
             * sidebar de casi todas las páginas del sitio, siempre con los mismos
             * jugadores; sin esto, cada visita a cualquier página precargaba de fondo
             * la ficha de cada uno de ellos. */}
            <Link href={`/players/${p.playerId}`} prefetch={false} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-paper-tint">
              <span className="tour-numeric text-headline w-5 shrink-0 text-right text-sm text-ink">{p.rank}</span>
              <PlayerAvatar displayName={p.displayName} country={p.country} avatarUrl={p.avatarUrl} size="xs" />
              <span className="text-ink min-w-0 flex-1 truncate text-sm">{p.displayName}</span>
              <span className="tour-numeric text-muted-label shrink-0 text-xs">{p.points.toLocaleString("en-US")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SidebarPanel>
  );
}
