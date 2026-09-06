/**
 * Validación de marcador genérica, sin nada específico de las Finals — vive aparte
 * de lib/finals/format.ts (que solo añade el catálogo de formatos POR TIPO de
 * Finals) para que un partido de torneo normal (native o, en el futuro, cualquier
 * otro sitio que necesite validar un marcador) no tenga que importar tipos con
 * nombre "Finals" para algo que no lo es.
 */
export interface SetFormat {
  gamesPerSet: number; // 6 = set estándar, 4 = Fast4
  setsToWin: number; // 2 = al mejor de 3, 3 = al mejor de 5
}

export const STANDARD_FORMAT: SetFormat = { gamesPerSet: 6, setsToWin: 2 };

/**
 * Valida un set suelto contra el formato: da igual qué número venga primero, se
 * trata como un par sin ordenar (el "ganador del set" es el mayor de los dos).
 *   - Set estándar (a 6): 6-0..6-4, o rotura a 7 (7-5, o 7-6 con tie-break).
 *   - Fast4 (a 4): 4-0..4-3 — la muerte súbita a 3-3 siempre deja al ganador en 4
 *     juegos, igual que un 7-6 estándar, así que no hace falta un caso aparte.
 */
export function isValidSetScore(a: number, b: number, format: SetFormat): boolean {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (loser < 0) return false;
  if (format.gamesPerSet === 6) {
    return (winner === 6 && loser <= 4) || (winner === 7 && (loser === 5 || loser === 6));
  }
  return winner === format.gamesPerSet && loser < format.gamesPerSet;
}

/**
 * Un partido "played" (no retirado/walkover/descalificado) tiene que terminar justo
 * cuando el ganador llega a `setsToWin` sets — ni antes ni con sets de más. `sets`
 * viene siempre en perspectiva del ganador DEL PARTIDO, así que basta contar cuántos
 * de esos sets tiene realmente ganados.
 */
export function isCompleteMatchScore(sets: { winnerGames: number; loserGames: number }[], format: SetFormat): boolean {
  const setsWonByMatchWinner = sets.filter((s) => s.winnerGames > s.loserGames).length;
  const setsWonByOpponent = sets.length - setsWonByMatchWinner;
  return setsWonByMatchWinner === format.setsToWin && setsWonByOpponent < format.setsToWin;
}
