/**
 * El último índice de un `setGames` en vivo es SIEMPRE el set en curso (todavía sin
 * decidir) — nunca se resalta como ganado. Los anteriores ya están cerrados, así que
 * quien tenga más juegos en ese índice se llevó ese set concreto — mismo criterio de
 * "resaltar el set, no el ganador del partido" que `components/tournament/
 * MatchCard.tsx::setWinners` usa para partidos ya decididos, aquí adaptado a la forma
 * en que llega el marcador en vivo (arrays de string, no `sets` ya resueltos).
 * Compartido entre `LiveScoresStrip.tsx` y `MatchCard.tsx` (su propio marcador en vivo
 * dentro del cuadro) para no duplicar la misma regla dos veces.
 */
export function completedSetWinners(mine: string[], theirs: string[]): boolean[] {
  return mine.slice(0, -1).map((g, i) => Number(g) > Number(theirs[i] ?? 0));
}
