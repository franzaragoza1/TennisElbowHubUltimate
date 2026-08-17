import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { editionRoundPoints, editions, events, matches, pendingSlots } from "@/db/schema";
import { fullRoundLadder } from "@/lib/bracket";
import { computeSecuredPoints, type DecidedMatchOutcome } from "./roundPoints";

export interface SecuredPointsEntry {
  /** Suma de puntos asegurados en TODAS las ediciones pasadas (normalmente una sola —
   * jugar dos torneos a la vez es un caso raro, pero se suma bien si pasara). */
  points: number;
  isChampion: boolean;
  /** Edición usada para la narrativa de "Current Tournament" — si hay varias, la que
   * más puntos aporta (desempate razonable para un caso que casi nunca se da). */
  editionId: number;
  tournamentName: string;
  drawSize: number;
  round: string | null;
}

/**
 * Puntos ya asegurados por cada jugador en el conjunto de ediciones dado — sirve
 * tanto para "cuánto lleva ganado en el torneo en curso" (semana en vivo) como para
 * "cuánto ganó en la semana que ahora expira" (misma fórmula, aplicada a una semana ya
 * decidida del año anterior). Trae los partidos decididos de esas ediciones de una
 * sola vez (nada de N+1 por jugador) y reutiliza `computeSecuredPoints` — la misma
 * regla pura, no una reimplementación en SQL que pudiera desincronizarse.
 */
export async function getSecuredPointsByPlayer(editionIds: number[]): Promise<Map<number, SecuredPointsEntry>> {
  if (editionIds.length === 0) return new Map();

  const [editionRows, pointsRows, decidedMatches] = await Promise.all([
    db
      .select({ id: editions.id, drawSize: editions.drawSize, eventName: events.displayName })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .where(inArray(editions.id, editionIds)),
    db
      .select({ editionId: editionRoundPoints.editionId, round: editionRoundPoints.round, points: editionRoundPoints.points })
      .from(editionRoundPoints)
      .where(inArray(editionRoundPoints.editionId, editionIds)),
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
  const pointsByEdition = new Map<number, Record<string, number>>();
  for (const row of pointsRows) {
    if (!pointsByEdition.has(row.editionId)) pointsByEdition.set(row.editionId, {});
    pointsByEdition.get(row.editionId)![row.round] = row.points;
  }

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

  // Total sumado (para "cuánto lleva ganado en total") separado de "en qué edición
  // concreta enseñar la narrativa" — la que más puntos aporta por sí sola, para el
  // caso raro de estar en dos torneos la misma semana en vivo.
  const totalPointsByPlayer = new Map<number, number>();
  const bestPointsSeenByPlayer = new Map<number, number>();
  const bestByPlayer = new Map<number, Omit<SecuredPointsEntry, "points">>();

  for (const [key, outcomes] of outcomesByEditionPlayer) {
    const [editionIdStr, playerIdStr] = key.split(":");
    const editionId = Number(editionIdStr);
    const playerId = Number(playerIdStr);
    const edition = editionById.get(editionId);
    if (!edition) continue;

    const ladder = fullRoundLadder(edition.drawSize);
    const pointsByRound = pointsByEdition.get(editionId) ?? {};
    const secured = computeSecuredPoints(ladder, pointsByRound, outcomes);
    if (secured.points === 0 && secured.round === null) continue;

    totalPointsByPlayer.set(playerId, (totalPointsByPlayer.get(playerId) ?? 0) + secured.points);

    if (secured.points >= (bestPointsSeenByPlayer.get(playerId) ?? -1)) {
      bestPointsSeenByPlayer.set(playerId, secured.points);
      bestByPlayer.set(playerId, {
        isChampion: secured.isChampion,
        editionId,
        tournamentName: edition.eventName,
        drawSize: edition.drawSize,
        round: secured.round,
      });
    }
  }

  const result = new Map<number, SecuredPointsEntry>();
  for (const [playerId, points] of totalPointsByPlayer) {
    const best = bestByPlayer.get(playerId);
    if (!best) continue;
    result.set(playerId, { ...best, points });
  }
  return result;
}

export interface PendingParticipant {
  editionId: number;
  tournamentName: string;
  drawSize: number;
}

/**
 * Jugadores ya emparejados (`pending_slots`, cruce real aunque sin resultado) en el
 * conjunto de ediciones dado. Separado de `getSecuredPointsByPlayer` a propósito: un
 * jugador que todavía no ha jugado su primer partido no tiene puntos que asegurar
 * (0, correctamente excluido de ahí), pero SÍ necesita salir en "Current Tournament"
 * como "Will play next in the R64" — sin esto, esa fila del ranking en vivo quedaba
 * en blanco para cualquiera que aún no hubiera debutado en el torneo en curso.
 */
export async function getPendingParticipants(editionIds: number[]): Promise<Map<number, PendingParticipant>> {
  if (editionIds.length === 0) return new Map();

  const [editionRows, slots] = await Promise.all([
    db
      .select({ id: editions.id, drawSize: editions.drawSize, eventName: events.displayName })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .where(inArray(editions.id, editionIds)),
    db
      .select({ editionId: pendingSlots.editionId, player1Id: pendingSlots.player1Id, player2Id: pendingSlots.player2Id })
      .from(pendingSlots)
      .where(inArray(pendingSlots.editionId, editionIds)),
  ]);

  const editionById = new Map(editionRows.map((e) => [e.id, e]));
  const result = new Map<number, PendingParticipant>();
  for (const slot of slots) {
    const edition = editionById.get(slot.editionId);
    if (!edition) continue;
    for (const playerId of [slot.player1Id, slot.player2Id]) {
      if (playerId === null || result.has(playerId)) continue;
      result.set(playerId, { editionId: slot.editionId, tournamentName: edition.eventName, drawSize: edition.drawSize });
    }
  }
  return result;
}
