import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import type { H2HViewData } from "@/components/h2h/H2HView";
import type { H2HPlayerInfo } from "@/components/h2h/H2HHeader";
import type { H2HMatchRow } from "@/components/h2h/H2HMatchHistory";
import { getCareerStats, getH2HBreakdown, getH2HMeetings } from "./h2hStats";
import { getFinalsMeetings } from "./finals/h2h";

/**
 * Reúne todo lo que necesita `H2HView`. Vive aparte de la página porque lo usan dos
 * rutas: `/h2h` (nº1 contra nº2 por defecto) y `/h2h/[p1]/[p2]`.
 */
export async function loadH2HData(
  player1Id: number,
  player2Id: number,
): Promise<H2HViewData | null> {
  const currentYear = new Date().getFullYear();

  const [rows, meetings, finalsMeetings, stats1, stats2] = await Promise.all([
    db.select().from(players).where(eq(players.id, player1Id)),
    getH2HMeetings(player1Id, player2Id),
    getFinalsMeetings(player1Id, player2Id),
    getCareerStats(player1Id, currentYear),
    getCareerStats(player2Id, currentYear),
  ]);
  const [row2] = await db.select().from(players).where(eq(players.id, player2Id));
  const row1 = rows[0];
  if (!row1 || !row2) return null;

  const toInfo = (
    row: typeof row1,
    stats: typeof stats1,
  ): H2HPlayerInfo => ({
    id: row.id,
    displayName: row.displayName,
    country: row.countryOverride ?? row.country,
    avatarUrl: row.avatarUrl,
    currentRank: stats.currentRank,
    currentPoints: stats.currentPoints,
    careerHigh: stats.careerHigh,
    proSince: stats.firstSeenYear,
  });

  const breakdown = await getH2HBreakdown(player1Id, player2Id, meetings, finalsMeetings);

  // Tour + Finals combinados, del más reciente al más antiguo. Las Finals se colocan
  // al final de la temporada de su año (sortWeek sintético alto): el torneo se juega
  // tras el resto del calendario, y `finals_editions` no guarda semana ISO.
  const history: H2HMatchRow[] = [
    ...meetings.map((m) => ({
      sortWeek: m.isoWeek ?? 0,
      row: {
        matchId: m.matchId,
        href: `/tournaments/${m.editionId}`,
        year: m.year,
        isoWeek: m.isoWeek,
        eventName: m.eventName,
        round: m.round,
        surface: m.surface,
        player1Won: m.winnerId === player1Id,
        scoreRaw: m.scoreRaw,
      } satisfies H2HMatchRow,
    })),
    ...finalsMeetings.map((m) => ({
      sortWeek: 99,
      row: {
        matchId: m.matchId,
        href: `/finals/${m.finalsEditionId}`,
        year: m.year,
        isoWeek: null,
        eventName: m.eventName,
        round: m.round,
        surface: null, // Finals no tiene pista real (lib/finals/mirror.ts)
        player1Won: m.winnerId === player1Id,
        scoreRaw: m.scoreRaw,
      } satisfies H2HMatchRow,
    })),
  ]
    .sort((a, b) => b.row.year - a.row.year || b.sortWeek - a.sortWeek)
    .map((entry) => entry.row);

  return {
    player1: toInfo(row1, stats1),
    player2: toInfo(row2, stats2),
    // Un w.o. no cuenta como victoria de nadie en el marcador global (mismo criterio
    // que getCareerStats/getPlayerTotals/getYearRecords, docs/decisiones.md
    // 2026-08-16) — las Finals no tienen concepto de w.o. (finals_matches no guarda
    // `outcome`), así que ahí no hace falta filtrar nada.
    player1Wins:
      meetings.filter((m) => m.winnerId === player1Id && m.outcome !== "walkover").length +
      finalsMeetings.filter((m) => m.winnerId === player1Id).length,
    player2Wins:
      meetings.filter((m) => m.winnerId === player2Id && m.outcome !== "walkover").length +
      finalsMeetings.filter((m) => m.winnerId === player2Id).length,
    stats1,
    stats2,
    breakdown,
    history,
  };
}
