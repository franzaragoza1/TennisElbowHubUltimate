import { and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, pendingSlots, players } from "@/db/schema";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { roundOrderRank } from "@/lib/roundOrder";

export interface CurrentTournamentStatus {
  sentence: string;
  round: string;
}

interface DecidedRow {
  round: string;
  winner_id: number;
  opponent_name: string;
}

interface PendingRow {
  round: string;
  opponent_name: string | null;
}

export interface TournamentStatusQuery {
  playerId: number;
  editionId: number;
  drawSize: number;
}

/**
 * Frase estilo ATP ("Defeated C. Norrie and moved on to the R32" / "Will play next in
 * the R64" / "Lost to T. Tirante in the R64") a partir de lo que ya hay en `matches` +
 * `pending_slots` para cada (jugador, edición) pedido — nada nuevo que scrapear, solo
 * narrar datos ya importados. La etiqueta corta de ronda (R32, QF, SF, F — no "Round
 * of 32"/"Quarterfinals") sale de `roundDisplayLabel`/`fullRoundLadder`
 * (lib/bracket.ts), la misma que ya usan los chips del cuadro real.
 *
 * Por lotes a propósito (pase de rendimiento, 2026-09-13): antes era una función por
 * jugador, y `lib/liveRanking/liveRanking.ts` la llamaba una vez por cada uno dentro
 * de un `.map(async ...)` — un N+1 real en cada cálculo de ranking en vivo. Ahora los
 * partidos y cruces pendientes de TODAS las ediciones implicadas se traen de una sola
 * vez y se reparten en memoria por (edición, jugador) antes de aplicar `buildStatus`.
 */
export async function getCurrentTournamentStatusBatch(queries: TournamentStatusQuery[]): Promise<Map<number, CurrentTournamentStatus>> {
  const result = new Map<number, CurrentTournamentStatus>();
  if (queries.length === 0) return result;

  const editionIds = [...new Set(queries.map((q) => q.editionId))];

  const [decidedRows, pendingRows] = await Promise.all([
    db
      .select({
        editionId: matches.editionId,
        round: matches.round,
        winnerId: matches.winnerId,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
      })
      .from(matches)
      .where(and(inArray(matches.editionId, editionIds), isNotNull(matches.winnerId))),
    db
      .select({
        editionId: pendingSlots.editionId,
        round: pendingSlots.round,
        player1Id: pendingSlots.player1Id,
        player2Id: pendingSlots.player2Id,
      })
      .from(pendingSlots)
      .where(inArray(pendingSlots.editionId, editionIds)),
  ]);

  const involvedPlayerIds = new Set<number>();
  for (const m of decidedRows) {
    if (m.player1Id !== null) involvedPlayerIds.add(m.player1Id);
    if (m.player2Id !== null) involvedPlayerIds.add(m.player2Id);
  }
  for (const p of pendingRows) {
    if (p.player1Id !== null) involvedPlayerIds.add(p.player1Id);
    if (p.player2Id !== null) involvedPlayerIds.add(p.player2Id);
  }

  const nameRows = involvedPlayerIds.size
    ? await db
        .select({ id: players.id, displayName: players.displayName })
        .from(players)
        .where(inArray(players.id, [...involvedPlayerIds]))
    : [];
  const nameById = new Map(nameRows.map((r) => [r.id, r.displayName]));

  const decidedByKey = new Map<string, DecidedRow[]>();
  for (const m of decidedRows) {
    if (m.winnerId === null || m.player1Id === null || m.player2Id === null) continue;
    for (const playerId of [m.player1Id, m.player2Id]) {
      const opponentId = playerId === m.player1Id ? m.player2Id : m.player1Id;
      const key = `${m.editionId}:${playerId}`;
      if (!decidedByKey.has(key)) decidedByKey.set(key, []);
      decidedByKey.get(key)!.push({ round: m.round, winner_id: m.winnerId, opponent_name: nameById.get(opponentId) ?? "Unknown" });
    }
  }

  const pendingByKey = new Map<string, PendingRow[]>();
  for (const p of pendingRows) {
    for (const playerId of [p.player1Id, p.player2Id]) {
      if (playerId === null) continue;
      const opponentId = playerId === p.player1Id ? p.player2Id : p.player1Id;
      const key = `${p.editionId}:${playerId}`;
      if (!pendingByKey.has(key)) pendingByKey.set(key, []);
      pendingByKey.get(key)!.push({ round: p.round, opponent_name: opponentId !== null ? (nameById.get(opponentId) ?? null) : null });
    }
  }

  for (const q of queries) {
    const key = `${q.editionId}:${q.playerId}`;
    const status = buildStatus(q.playerId, q.drawSize, decidedByKey.get(key) ?? [], pendingByKey.get(key) ?? []);
    if (status) result.set(q.playerId, status);
  }

  return result;
}

function buildStatus(
  playerId: number,
  drawSize: number,
  decided: DecidedRow[],
  pending: PendingRow[],
): CurrentTournamentStatus | null {
  const ladder = fullRoundLadder(drawSize);
  const shortRound = (round: string) => roundDisplayLabel(ladder, round);

  const loss = decided.find((m) => m.winner_id !== playerId);
  if (loss) {
    return { sentence: `Lost to ${loss.opponent_name} in the ${shortRound(loss.round)}`, round: loss.round };
  }

  const wins = decided.filter((m) => m.winner_id === playerId).sort((a, b) => roundOrderRank(a.round) - roundOrderRank(b.round));
  const lastWin = wins[wins.length - 1];
  const next = pending[0];

  if (next) {
    const nextLabel = shortRound(next.round);
    if (lastWin) return { sentence: `Defeated ${lastWin.opponent_name} and moved on to the ${nextLabel}`, round: next.round };
    return { sentence: `Will play next in the ${nextLabel}`, round: next.round };
  }

  if (lastWin) {
    return { sentence: `Defeated ${lastWin.opponent_name} in the ${shortRound(lastWin.round)}`, round: lastWin.round };
  }

  return null;
}
