import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { PlayerIndex, type PlayerIndexRow } from "@/components/players/PlayerIndex";
import { getLatestRankingWeek, getPlayerTotals, getTopPlayers } from "@/lib/tourQueries";

export const revalidate = 3600;

export default async function PlayersPage() {
  const week = await getLatestRankingWeek();

  const [allPlayers, totals, ranked] = await Promise.all([
    db
      .select({
        id: players.id,
        displayName: players.displayName,
        country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
        character: players.character,
      })
      .from(players)
      .orderBy(players.displayName),
    getPlayerTotals(),
    // El ranking actual completo, para poder marcar quién está clasificado esta semana.
    week ? getTopPlayers(week, 10000) : Promise.resolve([]),
  ]);

  const rankByPlayer = new Map(ranked.map((r) => [r.playerId, r.rank]));

  const rows: PlayerIndexRow[] = allPlayers.map((p) => {
    const t = totals.get(p.id);
    return {
      id: p.id,
      displayName: p.displayName,
      country: p.country,
      character: p.character,
      currentRank: rankByPlayer.get(p.id) ?? null,
      wins: t?.wins ?? 0,
      losses: t?.losses ?? 0,
      titles: t?.titles ?? 0,
    };
  });

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="Players"
        subtitle={`${rows.length} players on record since 2021`}
      />
      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <PlayerIndex players={rows} />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
