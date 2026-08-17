/**
 * A qué ronda equivalen los puntos que un jugador tiene ya asegurados en una edición
 * concreta, a partir de sus partidos DECIDIDOS ahí. Pura, sin base de datos — mismo
 * motivo que lib/finals/stageRound.ts: se puede probar sin arrastrar @/db/client.
 *
 * La regla sale directamente de la convención de desplazamiento marcador↔ronda ya
 * documentada en docs/estructura.md y usada por parsers/tournamentPage.ts: la
 * columna de puntos de una ronda R es lo que gana quien queda ELIMINADO en R (o
 * quien todavía no ha perdido pero tampoco ha llegado más lejos). Ganar la ronda `F`
 * (la final en sí) es el único caso especial: no da los puntos de "F" sino los de la
 * columna siguiente, `W` — el escalón de campeón, mayor que el de subcampeón.
 */

export interface DecidedMatchOutcome {
  round: string;
  won: boolean;
}

export interface SecuredPointsResult {
  points: number;
  /** Ronda a la que corresponden esos puntos — `"W"` si es campeón, `null` si el
   * jugador no tiene ningún partido decidido todavía en esta edición. */
  round: string | null;
  isChampion: boolean;
}

const CHAMPION_ROUND = "W";
const FINAL_ROUND = "F";

/**
 * @param ladder Escalera completa de rondas jugables de esa edición, de la más
 *   temprana a la final (`fullRoundLadder(drawSize)` de lib/bracket.ts — NO incluye
 *   `"W"`, ese es solo una columna de puntos, nunca una ronda jugable real).
 * @param pointsByRound Puntos publicados por ronda para esta edición
 *   (`edition_round_points`, tal como los dio Mana Games) — incluye `"W"`.
 * @param decidedMatches Los partidos ya decididos de este jugador en esta edición
 *   (normalmente 0 o 1 derrota, y cero o más victorias previas).
 */
export function computeSecuredPoints(
  ladder: string[],
  pointsByRound: Record<string, number>,
  decidedMatches: DecidedMatchOutcome[],
): SecuredPointsResult {
  const wonFinal = decidedMatches.some((m) => m.round === FINAL_ROUND && m.won);
  if (wonFinal) {
    return { points: pointsByRound[CHAMPION_ROUND] ?? 0, round: CHAMPION_ROUND, isChampion: true };
  }

  const loss = decidedMatches.find((m) => !m.won);
  if (loss) {
    return { points: pointsByRound[loss.round] ?? 0, round: loss.round, isChampion: false };
  }

  const wins = decidedMatches.filter((m) => m.won);
  if (wins.length === 0) {
    return { points: 0, round: null, isChampion: false };
  }

  const mostAdvancedWin = wins.reduce((best, m) => {
    const bestIdx = ladder.indexOf(best.round);
    const idx = ladder.indexOf(m.round);
    return idx > bestIdx ? m : best;
  });
  const wonIdx = ladder.indexOf(mostAdvancedWin.round);
  // Ronda desconocida (no está en la escalera) -> no se puede avanzar con seguridad,
  // se queda en lo que ya tuviera asegurado antes (0, nunca se inventa una posición).
  if (wonIdx === -1) return { points: 0, round: null, isChampion: false };
  const nextRound = ladder[wonIdx + 1] ?? CHAMPION_ROUND;
  return { points: pointsByRound[nextRound] ?? 0, round: nextRound, isChampion: false };
}
