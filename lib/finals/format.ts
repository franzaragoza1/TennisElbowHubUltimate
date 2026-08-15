/**
 * Formato de partido por tipo de Finals. Cada `kind` de `finals_editions` implica su
 * formato entero — no hace falta una columna aparte en el esquema, es 1:1.
 */
export type FinalsKind = "tour_finals" | "next_gen_finals";

export interface FinalsFormat {
  kind: FinalsKind;
  label: string;
  setsToWin: number; // 2 = al mejor de 3, 3 = al mejor de 5
  gamesPerSet: number; // 6 = set estándar, 4 = Fast4
  scoreHint: string; // placeholder de los inputs de marcador
}

export const FINALS_FORMAT: Record<FinalsKind, FinalsFormat> = {
  tour_finals: {
    kind: "tour_finals",
    label: "World Tour Finals",
    setsToWin: 2,
    gamesPerSet: 6,
    scoreHint: "6-4",
  },
  next_gen_finals: {
    kind: "next_gen_finals",
    label: "Next Gen Finals",
    setsToWin: 3,
    gamesPerSet: 4,
    scoreHint: "4-2",
  },
};

export function getFinalsFormat(kind: string): FinalsFormat {
  return FINALS_FORMAT[kind as FinalsKind] ?? FINALS_FORMAT.tour_finals;
}

/**
 * Valida un set suelto contra el formato: da igual qué número venga primero, se
 * trata como un par sin ordenar (el "ganador del set" es el mayor de los dos).
 *   - Set estándar (a 6): 6-0..6-4, o rotura a 7 (7-5, o 7-6 con tie-break).
 *   - Fast4 (a 4): 4-0..4-3 — la muerte súbita a 3-3 siempre deja al ganador en 4
 *     juegos, igual que un 7-6 estándar, así que no hace falta un caso aparte.
 */
export function isValidSetScore(a: number, b: number, format: FinalsFormat): boolean {
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
 * viene siempre en perspectiva del ganador DEL PARTIDO (mismo convenio que la tabla
 * `finals_sets`), así que basta contar cuántos de esos sets tiene realmente ganados.
 */
export function isCompleteMatchScore(sets: { winnerGames: number; loserGames: number }[], format: FinalsFormat): boolean {
  const setsWonByMatchWinner = sets.filter((s) => s.winnerGames > s.loserGames).length;
  const setsWonByOpponent = sets.length - setsWonByMatchWinner;
  return setsWonByMatchWinner === format.setsToWin && setsWonByOpponent < format.setsToWin;
}
