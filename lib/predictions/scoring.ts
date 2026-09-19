/**
 * Puntuación del minijuego de predicciones — pura, sin BD, para poder testearla
 * directamente (mismo criterio que lib/predictor/preMatchModel.ts / liveModel.ts en
 * este mismo repo). Se calcula siempre al leer, nunca se guarda (ver el comentario de
 * `bracketPredictions` en db/schema.ts) — el marcador está vivo según van llegando
 * resultados reales, nada que resincronizar.
 *
 * `slotIndex` de un pick es la posición (índice, no `pending_slots.sortIndex`) del
 * hueco DENTRO de su ronda tal como la ordena `lib/bracket.ts::buildBracketLayout` —
 * la MISMA numeración que ya usa el cuadro real (`matchesByRound.get(round)[i]`).
 */
import type { BracketLayout, BracketMatchInput } from "../bracket";

export interface BracketPick {
  round: string;
  slotIndex: number;
  playerId: number;
}

export interface RoundScore {
  round: string;
  correct: number;
  /** Huecos de esta ronda que YA tienen un ganador real — un hueco sin decidir todavía
   * no cuenta ni a favor ni en contra, en ninguno de los dos números. */
  possible: number;
  points: number;
}

export interface PredictionScore {
  total: number;
  byRound: RoundScore[];
}

/** R1 (índice 0) vale 1, y se dobla cada ronda — la Final vale más que todas las
 * anteriores juntas, a propósito (pedido explícito: acertar el campeón pesa mucho más
 * que un acierto de primera ronda). */
export function pointsForRoundIndex(index: number): number {
  return 2 ** index;
}

export function scorePrediction<M extends BracketMatchInput>(picks: BracketPick[], layout: BracketLayout<M>): PredictionScore {
  const pickByKey = new Map(picks.map((p) => [`${p.round}:${p.slotIndex}`, p.playerId]));

  const byRound: RoundScore[] = layout.roundOrder.map((round, roundIndex) => {
    const slots = layout.matchesByRound.get(round) ?? [];
    const points = pointsForRoundIndex(roundIndex);
    let correct = 0;
    let possible = 0;
    slots.forEach((slot, slotIndex) => {
      const winnerId = slot.match.winnerId;
      if (winnerId === null) return; // hueco todavía sin decidir — no cuenta en ninguna dirección
      possible++;
      if (pickByKey.get(`${round}:${slotIndex}`) === winnerId) correct++;
    });
    return { round, correct, possible, points: correct * points };
  });

  return { total: byRound.reduce((sum, r) => sum + r.points, 0), byRound };
}
