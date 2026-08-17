import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { getLatestRankingWeek, getTopPlayers } from "@/lib/tourQueries";

export async function RankingsWidget() {
  const week = await getLatestRankingWeek();
  const top = week ? await getTopPlayers(week, 10) : [];
  if (top.length === 0) return null;

  return (
    <SidebarPanel title="RANKINGS" href="/rankings" linkLabel="Full rankings">
      <ul className="space-y-2">
        {top.map((p) => (
          <li key={p.playerId}>
            <Link href={`/players/${p.playerId}`} className="flex items-center gap-2.5 hover:text-blue-500">
              <span className="tour-numeric text-headline w-4 shrink-0 text-right text-sm text-ink">{p.rank}</span>
              <PlayerAvatar displayName={p.displayName} country={p.country} character={p.character} />
              <span className="text-ink min-w-0 flex-1 truncate text-sm">{p.displayName}</span>
              <span className="tour-numeric text-muted-label shrink-0 text-xs">{p.points.toLocaleString("en-US")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SidebarPanel>
  );
}
