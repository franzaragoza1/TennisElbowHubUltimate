/** Un set con 6+ juegos y 2 de ventaja, o 7-5, o 7-6 (tie-break) ya está cerrado según
 * las reglas normales de tenis — TE4 no juega con ventaja más allá del 6-6. */
function isSetOver(mine: number, theirs: number): boolean {
  const hi = Math.max(mine, theirs);
  const lo = Math.min(mine, theirs);
  if (hi < 6) return false;
  if (hi - lo >= 2) return true;
  return hi === 7 && lo === 6;
}

/**
 * Todos los índices de un `setGames` en vivo salvo el último están SIEMPRE cerrados
 * (nadie llega al siguiente set sin decidir el anterior), así que ahí basta con
 * comparar juegos. El último puede estar en curso de verdad, o puede estar ya
 * decidido con la sesión de juego todavía abierta (partido terminado, pero los
 * jugadores siguen dentro charlando) — bug real reportado, 2026-09-14: un 6-0 6-1 ya
 * resuelto se enseñaba sin resaltar ese último set, porque antes se descartaba sin
 * mirar el marcador. Ahora el último también se resalta si su propio marcador ya
 * cumple una condición de set cerrado (`isSetOver`); si de verdad sigue abierto
 * (p.ej. 4-3), se queda sin resaltar como siempre. Mismo criterio de "resaltar el
 * set, no el ganador del partido" que `components/tournament/
 * MatchCard.tsx::setWinners` usa para partidos ya decididos, aquí adaptado a la forma
 * en que llega el marcador en vivo (arrays de string, no `sets` ya resueltos).
 * Compartido entre `LiveScoresStrip.tsx` y `MatchCard.tsx` (su propio marcador en vivo
 * dentro del cuadro) para no duplicar la misma regla dos veces.
 */
export function completedSetWinners(mine: string[], theirs: string[]): boolean[] {
  return mine.map((g, i) => {
    const m = Number(g);
    const t = Number(theirs[i] ?? 0);
    if (i === mine.length - 1 && !isSetOver(m, t)) return false;
    return m > t;
  });
}
