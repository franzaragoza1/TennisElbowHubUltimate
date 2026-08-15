export interface MatchSetScore {
  setNumber: number;
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

export interface PerspectiveScore {
  games: number;
  superscript: number | null;
}

/**
 * Marcador set a set desde el punto de vista de un jugador concreto. `winnerGames`/
 * `loserGames` en la tabla `sets` están escritos siempre desde la perspectiva del
 * ganador DEL PARTIDO (así viene la notación fuente, "6/7(5) 6/4 7/6(3)" — el primer
 * número de cada set es del ganador del partido aunque haya perdido ese set concreto).
 *
 * El superíndice va SIEMPRE pegado a `loserGames` (confirmado contra datos reales:
 * `score_raw: "6/7(3) 7/6(4) 7/5"` tiene el "(3)" pegado al "7" aunque 7 sea el número
 * más alto de ese set — el ganador del partido perdió ESE set en la muerte súbita). No
 * es "el lado que perdió ese set" (una comparación de magnitud daría el lado
 * equivocado justo en este caso, que es exactamente el que importa): es sencillamente
 * el lado del perdedor del partido, siempre, para cada set.
 */
export function scoreFromPerspective(sets: MatchSetScore[], playerWonMatch: boolean): PerspectiveScore[] {
  return sets.map((s) => ({
    games: playerWonMatch ? s.winnerGames : s.loserGames,
    superscript: playerWonMatch ? null : s.tiebreakLoserPoints,
  }));
}

export interface PairedSetScore {
  playerGames: number;
  opponentGames: number;
  playerSuperscript: number | null;
  opponentSuperscript: number | null;
}

/**
 * Igual que `scoreFromPerspective`, pero con los dos números del set a la vez (para una
 * fila por partido en vez de una fila por jugador) — el superíndice cae del lado del
 * perdedor del partido, sea el propio jugador o el rival.
 */
export function pairedScoreFromPerspective(sets: MatchSetScore[], playerWonMatch: boolean): PairedSetScore[] {
  return sets.map((s) => ({
    playerGames: playerWonMatch ? s.winnerGames : s.loserGames,
    opponentGames: playerWonMatch ? s.loserGames : s.winnerGames,
    playerSuperscript: playerWonMatch ? null : s.tiebreakLoserPoints,
    opponentSuperscript: playerWonMatch ? s.tiebreakLoserPoints : null,
  }));
}
