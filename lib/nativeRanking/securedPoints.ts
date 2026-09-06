import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, matches } from "@/db/schema";
import { computeSecuredPoints, type DecidedMatchOutcome } from "@/lib/liveRanking/roundPoints";
import { fullRoundLadder } from "@/lib/bracket";
import { getPointsByRoundForEdition } from "./pointTables";

export interface NativeSecuredPointsEntry {
  points: number;
  isChampion: boolean;
  editionId: number;
  round: string | null;
}

/**
 * Igual que lib/liveRanking/securedPoints.ts::getSecuredPointsByPlayer (misma
 * `computeSecuredPoints` pura, reutilizada tal cual — nada de reimplementar la
 * regla), pero los puntos por ronda salen de `getPointsByRoundForEdition`
 * (lib/nativeRanking/pointTables.ts, tablas fijas/curva) en vez de la tabla
 * `edition_round_points` importada: las ediciones nativas nunca tienen fila ahí,
 * sus puntos se calculan, no se importan (ver docs/decisiones.md, "Fresh start").
 */
export async function getNativeSecuredPointsByPlayer(editionIds: number[]): Promise<Map<number, NativeSecuredPointsEntry>> {
  if (editionIds.length === 0) return new Map();

  const [editionRows, decidedMatches] = await Promise.all([
    db
      .select({ id: editions.id, drawSize: editions.drawSize, category: editions.category })
      .from(editions)
      .where(inArray(editions.id, editionIds)),
    db
      .select({
        editionId: matches.editionId,
        round: matches.round,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        winnerId: matches.winnerId,
      })
      .from(matches)
      .where(inArray(matches.editionId, editionIds)),
  ]);

  const editionById = new Map(editionRows.map((e) => [e.id, e]));

  // (editionId, playerId) -> sus partidos decididos en esa edición.
  const outcomesByEditionPlayer = new Map<string, DecidedMatchOutcome[]>();
  const addOutcome = (editionId: number, playerId: number | null, won: boolean, round: string) => {
    if (playerId === null) return;
    const key = `${editionId}:${playerId}`;
    if (!outcomesByEditionPlayer.has(key)) outcomesByEditionPlayer.set(key, []);
    outcomesByEditionPlayer.get(key)!.push({ round, won });
  };
  for (const m of decidedMatches) {
    if (m.winnerId === null) continue;
    const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
    addOutcome(m.editionId, m.winnerId, true, m.round);
    addOutcome(m.editionId, loserId, false, m.round);
  }

  const totalPointsByPlayer = new Map<number, number>();
  const bestPointsSeenByPlayer = new Map<number, number>();
  const bestByPlayer = new Map<number, Omit<NativeSecuredPointsEntry, "points">>();

  for (const [key, outcomes] of outcomesByEditionPlayer) {
    const [editionIdStr, playerIdStr] = key.split(":");
    const editionId = Number(editionIdStr);
    const playerId = Number(playerIdStr);
    const edition = editionById.get(editionId);
    if (!edition) continue;

    const ladder = fullRoundLadder(edition.drawSize);
    const pointsByRound = getPointsByRoundForEdition(edition.category, edition.drawSize);
    const secured = computeSecuredPoints(ladder, pointsByRound, outcomes);
    if (secured.points === 0 && secured.round === null) continue;

    totalPointsByPlayer.set(playerId, (totalPointsByPlayer.get(playerId) ?? 0) + secured.points);

    if (secured.points >= (bestPointsSeenByPlayer.get(playerId) ?? -1)) {
      bestPointsSeenByPlayer.set(playerId, secured.points);
      bestByPlayer.set(playerId, { isChampion: secured.isChampion, editionId, round: secured.round });
    }
  }

  const result = new Map<number, NativeSecuredPointsEntry>();
  for (const [playerId, points] of totalPointsByPlayer) {
    const best = bestByPlayer.get(playerId);
    if (!best) continue;
    result.set(playerId, { ...best, points });
  }
  return result;
}
