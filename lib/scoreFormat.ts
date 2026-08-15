export interface ScoreSet {
  setNumber: number;
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

/** "6-2, 6-3" o "7-6(5), 4-6, 7-5" — los sets ya vienen en perspectiva del ganador DEL
 * PARTIDO (confirmado contra datos reales, ver docs/decisiones.md), así que
 * `winnerGames` va siempre primero, sin necesidad de averiguar quién ganó. */
export function formatFriendlyScore(sets: ScoreSet[]): string {
  return sets
    .map((s) => `${s.winnerGames}-${s.loserGames}${s.tiebreakLoserPoints !== null ? `(${s.tiebreakLoserPoints})` : ""}`)
    .join(", ");
}

/** Frase de resumen al estilo "Game, Set and Match" de la referencia — nunca inventa
 * un marcador que no tengamos: para walkover/descalificación no hay sets que enseñar,
 * así que la frase ni lo intenta. */
export function matchSummary(
  outcome: string,
  winnerName: string,
  loserName: string,
  sets: ScoreSet[],
): string {
  switch (outcome) {
    case "walkover":
      return `${winnerName} advances after a walkover.`;
    case "disqualified":
      return `${winnerName} advances after ${loserName} was disqualified.`;
    case "random":
      return `${winnerName} advances (Random Luck).`;
    case "retired": {
      const score = sets.length > 0 ? ` ${formatFriendlyScore(sets)}` : "";
      return `${winnerName} wins after ${loserName} retired,${score}.`;
    }
    default:
      return `Game, set and match ${winnerName}. ${winnerName} wins the match ${formatFriendlyScore(sets)}.`;
  }
}
