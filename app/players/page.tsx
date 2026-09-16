import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { PlayerIndex, type PlayerIndexRow } from "@/components/players/PlayerIndex";
import { RecentWinnersCarousel } from "@/components/players/RecentWinnersCarousel";
import { PlayersH2HCompare } from "@/components/players/PlayersH2HCompare";
import { NewsRail } from "@/components/news/NewsRail";
import { getLatestRankingWeek, getPlayerTotals, getRecentTourWinners, getTopPlayers } from "@/lib/tourQueries";
import { getFeaturedVideos } from "@/lib/youtube/featured";
import { getPublishedNewsWithTaggedPlayers } from "@/lib/newsQueries";

export const revalidate = 3600;

export default async function PlayersPage() {
  const week = await getLatestRankingWeek();

  const [allPlayers, totals, ranked, recentWinners, highlights, taggedNews] = await Promise.all([
    db
      .select({
        id: players.id,
        displayName: players.displayName,
        country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
        character: players.character,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .orderBy(players.displayName),
    getPlayerTotals(),
    // El ranking actual completo, para poder marcar quién está clasificado esta semana.
    week ? getTopPlayers(week, 10000) : Promise.resolve([]),
    getRecentTourWinners(8),
    getFeaturedVideos(2),
    getPublishedNewsWithTaggedPlayers(6),
  ]);

  const rankByPlayer = new Map(ranked.map((r) => [r.playerId, r.rank]));

  const rows: PlayerIndexRow[] = allPlayers.map((p) => {
    const t = totals.get(p.id);
    return {
      id: p.id,
      displayName: p.displayName,
      country: p.country,
      character: p.character,
      avatarUrl: p.avatarUrl,
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
          <RecentWinnersCarousel winners={recentWinners} highlights={highlights} />
          <PlayerIndex players={rows} />
          <div className="mt-8">
            <PlayersH2HCompare />
          </div>
        </div>
        <Sidebar />
      </div>
      {/* `NewsRail` sale de la rejilla con sidebar a propósito, igual que en la home —
       * el propio carril ya sangra hasta el borde real de la pantalla para insinuar que
       * hay más; contra los 320px del sidebar solo lo estrecharía sin motivo.
       * `PlayersH2HCompare` en cambio SÍ vive dentro de la columna del sidebar — ver el
       * comentario largo en ese componente sobre por qué sacarla de ahí cambiaba un bug
       * real (desbordamiento) por otro (hueco vacío enorme antes de esta sección). */}
      <NewsRail items={taggedNews} />
    </div>
  );
}
