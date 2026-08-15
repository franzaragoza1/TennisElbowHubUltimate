import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { finalsEditions, finalsMatches, finalsSets, players } from "@/db/schema";

const STAGE_ROUND_LABEL: Record<string, string> = { group: "RR", semifinal: "SF", final: "F" };

/**
 * Cruces entre dos jugadores en las Tour Finals (grupo + eliminatorias) — el motor de
 * H2H del tour principal (`lib/h2hStats.ts`) no sabe nada de `finals_matches`, así que
 * esto es un dato aparte que `loadH2HData` combina con los cruces del tour, no un
 * reemplazo. Sin superficie ni categoría: las Finals no registran ninguna de las dos,
 * así que estos partidos no entran en los desgloses por superficie/categoría, solo en
 * la lista de cruces, el marcador global y el desglose por ronda/año.
 */
export interface FinalsH2HMeeting {
  matchId: number;
  finalsEditionId: number;
  year: number;
  eventName: string;
  round: string; // 'RR' | 'SF' | 'F'
  winnerId: number;
  winnerName: string;
  loserName: string;
  scoreRaw: string | null;
  setsWonByWinner: number;
  setsWonByLoser: number;
  gamesWonByWinner: number;
  gamesWonByLoser: number;
  tiebreaksWonByWinner: number;
  tiebreaksWonByLoser: number;
}

export async function getFinalsMeetings(player1Id: number, player2Id: number): Promise<FinalsH2HMeeting[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  const rows = await db
    .select({
      matchId: finalsMatches.id,
      finalsEditionId: finalsMatches.finalsEditionId,
      stage: finalsMatches.stage,
      winnerId: finalsMatches.winnerId,
      player1Id: finalsMatches.player1Id,
      player1Name: p1.displayName,
      player2Name: p2.displayName,
      year: finalsEditions.year,
      eventName: finalsEditions.displayName,
    })
    .from(finalsMatches)
    .innerJoin(finalsEditions, eq(finalsEditions.id, finalsMatches.finalsEditionId))
    .innerJoin(p1, eq(p1.id, finalsMatches.player1Id))
    .innerJoin(p2, eq(p2.id, finalsMatches.player2Id))
    .where(
      and(
        isNotNull(finalsMatches.winnerId),
        or(
          and(eq(finalsMatches.player1Id, player1Id), eq(finalsMatches.player2Id, player2Id)),
          and(eq(finalsMatches.player1Id, player2Id), eq(finalsMatches.player2Id, player1Id)),
        ),
      ),
    );
  if (rows.length === 0) return [];

  const setRows = await db.select().from(finalsSets).where(inArray(finalsSets.matchId, rows.map((r) => r.matchId)));
  setRows.sort((a, b) => a.setNumber - b.setNumber);
  const setsByMatch = new Map<number, typeof setRows>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push(s);
  }

  return rows.map((r) => {
    const matchWinnerId = r.winnerId!;
    const winnerName = matchWinnerId === r.player1Id ? r.player1Name : r.player2Name;
    const loserName = matchWinnerId === r.player1Id ? r.player2Name : r.player1Name;
    const sets = setsByMatch.get(r.matchId) ?? [];

    let setsWonByWinner = 0;
    let setsWonByLoser = 0;
    let gamesWonByWinner = 0;
    let gamesWonByLoser = 0;
    let tiebreaksWonByWinner = 0;
    let tiebreaksWonByLoser = 0;
    for (const s of sets) {
      const winnerWonSet = s.winnerGames > s.loserGames;
      if (winnerWonSet) setsWonByWinner++;
      else setsWonByLoser++;
      gamesWonByWinner += s.winnerGames;
      gamesWonByLoser += s.loserGames;
      if (s.tiebreakLoserPoints !== null) {
        if (winnerWonSet) tiebreaksWonByWinner++;
        else tiebreaksWonByLoser++;
      }
    }

    return {
      matchId: r.matchId,
      finalsEditionId: r.finalsEditionId,
      year: r.year,
      eventName: r.eventName,
      round: STAGE_ROUND_LABEL[r.stage] ?? r.stage,
      winnerId: matchWinnerId,
      winnerName,
      loserName,
      scoreRaw: sets.length > 0 ? sets.map((s) => `${s.winnerGames}-${s.loserGames}`).join(" ") : null,
      setsWonByWinner,
      setsWonByLoser,
      gamesWonByWinner,
      gamesWonByLoser,
      tiebreaksWonByWinner,
      tiebreaksWonByLoser,
    };
  });
}
