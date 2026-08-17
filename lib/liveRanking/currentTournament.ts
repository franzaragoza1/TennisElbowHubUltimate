import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { roundOrderRank } from "@/lib/roundOrder";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

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

/**
 * Frase estilo ATP ("Defeated C. Norrie and moved on to the R32" / "Will play next in
 * the R64" / "Lost to T. Tirante in the R64") a partir de lo que ya hay en `matches` +
 * `pending_slots` para este jugador en esta edición — nada nuevo que scrapear, solo
 * narrar datos ya importados. La etiqueta corta de ronda (R32, QF, SF, F — no "Round
 * of 32"/"Quarterfinals") sale de `roundDisplayLabel`/`fullRoundLadder`
 * (lib/bracket.ts), la misma que ya usan los chips del cuadro real — pedido explícito
 * de mantener el mismo código corto en vez de la frase larga de `lib/roundPhrase.ts`.
 */
export async function getCurrentTournamentStatus(
  playerId: number,
  editionId: number,
  drawSize: number,
): Promise<CurrentTournamentStatus | null> {
  const [decidedResult, pendingResult] = await Promise.all([
    db.execute(sql`
      SELECT
        m.round,
        m.winner_id,
        opp.display_name AS opponent_name
      FROM matches m
      JOIN players opp ON opp.id = (CASE WHEN m.player1_id = ${playerId} THEN m.player2_id ELSE m.player1_id END)
      WHERE m.edition_id = ${editionId} AND (m.player1_id = ${playerId} OR m.player2_id = ${playerId}) AND m.winner_id IS NOT NULL
    `),
    db.execute(sql`
      SELECT
        ps.round,
        opp.display_name AS opponent_name
      FROM pending_slots ps
      LEFT JOIN players opp ON opp.id = (CASE WHEN ps.player1_id = ${playerId} THEN ps.player2_id ELSE ps.player1_id END)
      WHERE ps.edition_id = ${editionId} AND (ps.player1_id = ${playerId} OR ps.player2_id = ${playerId})
    `),
  ]);

  const decided = rowsOf<DecidedRow>(decidedResult).map((r) => ({ ...r, winner_id: Number(r.winner_id) }));
  const pending = rowsOf<PendingRow>(pendingResult);

  return buildStatus(playerId, drawSize, decided, pending);
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
