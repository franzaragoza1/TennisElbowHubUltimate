import { db } from "@/db/client";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { getLatestRankingWeek, getTopPlayers } from "@/lib/tourQueries";
import { getCareerStats } from "@/lib/h2hStats";

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
export async function ProfileWidget() {
  const week = await getLatestRankingWeek();
  const top = week ? await getTopPlayers(week, FEATURED_POOL_SIZE) : [];
  if (top.length === 0) return null;

  const playerId = top[Math.floor(Math.random() * top.length)].playerId;
  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) return null;

  const stats = await getCareerStats(playerId, new Date().getFullYear());

  return (
    <SidebarPanel title="PROFILE" href={`/players/${playerId}`} linkLabel="View all">
      <div className="mb-3 flex items-center gap-3">
        <PlayerAvatar displayName={player.displayName} country={player.countryOverride ?? player.country} character={player.character} size="lg" />
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
