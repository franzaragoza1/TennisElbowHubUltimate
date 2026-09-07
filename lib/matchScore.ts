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
 * El superíndice va con quien perdió ESE set en concreto — el número MÁS BAJO de los
 * dos, nunca "el lado del perdedor del partido" a secas (bug real reportado y
 * corregido, 2026-09-07: en "6/7(2)" el ganador del partido se quedó con 6 y perdió
 * esa muerte súbita en concreto, así que el "(2)" es suyo, no del rival, aunque el
 * rival haya perdido el partido entero). Coincide con "el perdedor del partido" en el
 * caso normal (que ganó también ese set) precisamente porque ahí SÍ tiene el número
 * más bajo — la comparación de magnitud da el lado correcto siempre, el atajo por
 * resultado del partido solo por casualidad en ese caso.
 */
export function scoreFromPerspective(sets: MatchSetScore[], playerWonMatch: boolean): PerspectiveScore[] {
  return sets.map((s) => {
    const games = playerWonMatch ? s.winnerGames : s.loserGames;
    const opponentGames = playerWonMatch ? s.loserGames : s.winnerGames;
    return { games, superscript: games < opponentGames ? s.tiebreakLoserPoints : null };
  });
}

export interface PairedSetScore {
  playerGames: number;
  opponentGames: number;
  playerSuperscript: number | null;
  opponentSuperscript: number | null;
}

/**
 * Igual que `scoreFromPerspective`, pero con los dos números del set a la vez (para una
 * fila por partido en vez de una fila por jugador) — el superíndice cae del lado que
 * perdió ESE set (el número más bajo), sea el propio jugador o el rival, gane o no el
 * partido — ver el comentario de `scoreFromPerspective`.
 */
export function pairedScoreFromPerspective(sets: MatchSetScore[], playerWonMatch: boolean): PairedSetScore[] {
  return sets.map((s) => {
    const playerGames = playerWonMatch ? s.winnerGames : s.loserGames;
    const opponentGames = playerWonMatch ? s.loserGames : s.winnerGames;
    const playerLostSet = playerGames < opponentGames;
    return {
      playerGames,
      opponentGames,
      playerSuperscript: playerLostSet ? s.tiebreakLoserPoints : null,
      opponentSuperscript: playerLostSet ? null : s.tiebreakLoserPoints,
    };
  });
}
