import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import type { H2HViewData } from "@/components/h2h/H2HView";
import type { H2HPlayerInfo } from "@/components/h2h/H2HHeader";
import { getCareerStats, getH2HBreakdown, getH2HMeetings } from "./h2hStats";

/**
 * Reúne todo lo que necesita `H2HView`. Vive aparte de la página porque lo usan dos
 * rutas: `/h2h` (nº1 contra nº2 por defecto) y `/h2h/[p1]/[p2]`.
 */
export async function loadH2HData(
  player1Id: number,
  player2Id: number,
): Promise<H2HViewData | null> {
  const currentYear = new Date().getFullYear();

  const [rows, meetings, stats1, stats2] = await Promise.all([
    db.select().from(players).where(eq(players.id, player1Id)),
    getH2HMeetings(player1Id, player2Id),
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
    country: row.country,
    character: row.character,
    currentRank: stats.currentRank,
    currentPoints: stats.currentPoints,
    careerHigh: stats.careerHigh,
    proSince: stats.firstSeenYear,
  });

  const breakdown = await getH2HBreakdown(player1Id, player2Id, meetings);

  return {
    player1: toInfo(row1, stats1),
    player2: toInfo(row2, stats2),
    player1Wins: meetings.filter((m) => m.winnerId === player1Id).length,
    player2Wins: meetings.filter((m) => m.winnerId === player2Id).length,
    stats1,
    stats2,
    breakdown,
    history: meetings.map((m) => ({
      matchId: m.matchId,
      editionId: m.editionId,
      year: m.year,
      isoWeek: m.isoWeek,
      eventName: m.eventName,
      round: m.round,
      winnerName: m.winnerName,
      loserName: m.loserName,
      scoreRaw: m.scoreRaw,
    })),
  };
}
