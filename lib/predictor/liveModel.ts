import type { SetFormat } from "../tennisScore";
import { completedSetWinners } from "../liveTennis/liveSetWinners";
import type { LiveTourMatch } from "../liveTennis/resolveAgainstOngoing";

/**
 * Modelo de probabilidad de partido estándar de tenis: saque→juego (fórmula cerrada),
 * juego→set (recursión sobre el marcador de juegos, con tie-break en 6-6 para el
 * formato estándar), set→partido (recursión sobre el marcador de sets). `holdA`/`holdB`
 * son la probabilidad de cada jugador de ganar un punto sacando — la misma cifra se usa
 * de sacador (`hold`) y, como complemento, de restador (`1 - holdDelOtro`): no hay dato
 * de devolución específico contra CADA rival, así que la propia cifra de saque de cada
 * uno hace de las dos veces, misma simplificación que usan los trackers de probabilidad
 * reales (ver el "Scope decisions" del plan). Todo esto es matemática de tenis
 * publicada, no un modelo entrenado — ver lib/predictor/preMatch.ts para el motivo.
 */

function deuceClosedForm(holdA: number, holdB: number, nextBlockServerIsA: boolean): number {
  // Más allá de 6-6 en el tie-break, cada bloque de 2 puntos lo saca íntegro un mismo
  // jugador (ver el patrón real de saque del tie-break) — el estado "empatados,
  // arranca bloque X" se repite indefinidamente, así que se resuelve como punto fijo
  // en vez de recursión sin cota. VA = valor cuando A saca el bloque; VB, cuando B lo
  // saca. Sistema:
  //   VA = holdA² + 2·holdA·(1-holdA)·VB
  //   VB = (1-holdB)² + 2·holdB·(1-holdB)·VA
  const denom = 1 - 4 * holdA * (1 - holdA) * holdB * (1 - holdB);
  const vA = (holdA * holdA + 2 * holdA * (1 - holdA) * (1 - holdB) * (1 - holdB)) / denom;
  const vB = (1 - holdB) * (1 - holdB) + 2 * holdB * (1 - holdB) * vA;
  return nextBlockServerIsA ? vA : vB;
}

/** Quién saca el punto número `totalPlayed + 1` del tie-break: el primer punto lo saca
 * quien empieza; a partir de ahí se turnan en bloques de 2, empezando por el otro. */
function tiebreakServerIsA(totalPlayed: number, firstServerIsA: boolean): boolean {
  if (totalPlayed === 0) return firstServerIsA;
  const blockIndex = Math.floor((totalPlayed - 1) / 2);
  const otherServesThisBlock = blockIndex % 2 === 0;
  return otherServesThisBlock ? !firstServerIsA : firstServerIsA;
}

function tiebreakProbAWinsFrom(a: number, b: number, firstServerIsA: boolean, holdA: number, holdB: number, memo: Map<string, number>): number {
  if ((a >= 7 || b >= 7) && Math.abs(a - b) >= 2) return a > b ? 1 : 0;
  if (a === b && a >= 6) {
    const nextServerIsA = tiebreakServerIsA(a + b, firstServerIsA);
    return deuceClosedForm(holdA, holdB, nextServerIsA);
  }
  const key = `${a},${b}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  const serverIsA = tiebreakServerIsA(a + b, firstServerIsA);
  const pAWinsPoint = serverIsA ? holdA : 1 - holdB;
  const result = pAWinsPoint * tiebreakProbAWinsFrom(a + 1, b, firstServerIsA, holdA, holdB, memo) + (1 - pAWinsPoint) * tiebreakProbAWinsFrom(a, b + 1, firstServerIsA, holdA, holdB, memo);
  memo.set(key, result);
  return result;
}

/** Probabilidad de que A gane un tie-break a 7 (por 2), dado el saque de cada uno. */
export function probWinTiebreak(holdA: number, holdB: number, firstServerIsA = true): number {
  return tiebreakProbAWinsFrom(0, 0, firstServerIsA, holdA, holdB, new Map());
}

/** Probabilidad de ganar un juego sacando, dada la probabilidad de ganar un punto
 * sacando — fórmula cerrada clásica (incluye la ventaja infinita resuelta en cerrado). */
export function probWinGameOnServe(pointWinProb: number): number {
  const p = pointWinProb;
  const q = 1 - p;
  const deuce = (p * p) / (p * p + q * q);
  return p ** 4 * (1 + 4 * q + 10 * q * q) + 20 * p ** 3 * q ** 3 * deuce;
}

function isSetDecided(gamesA: number, gamesB: number, format: SetFormat): "A" | "B" | null {
  if (format.gamesPerSet !== 6) {
    if (gamesA === format.gamesPerSet && gamesB < format.gamesPerSet) return "A";
    if (gamesB === format.gamesPerSet && gamesA < format.gamesPerSet) return "B";
    return null;
  }
  if (gamesA >= 6 && gamesA - gamesB >= 2) return "A";
  if (gamesB >= 6 && gamesB - gamesA >= 2) return "B";
  if (gamesA === 7) return "A";
  if (gamesB === 7) return "B";
  return null;
}

function probWinSetFrom(
  gamesA: number,
  gamesB: number,
  aServesNext: boolean,
  pointHoldA: number,
  pointHoldB: number,
  gameHoldA: number,
  gameHoldB: number,
  format: SetFormat,
  memo: Map<string, number>,
): number {
  const decided = isSetDecided(gamesA, gamesB, format);
  if (decided === "A") return 1;
  if (decided === "B") return 0;
  if (format.gamesPerSet === 6 && gamesA === 6 && gamesB === 6) {
    // El tie-break se juega punto a punto, no juego a juego — usa las probabilidades
    // de PUNTO, no las de juego que gobiernan el resto de esta función.
    return probWinTiebreak(pointHoldA, pointHoldB, aServesNext);
  }
  const key = `${gamesA},${gamesB},${aServesNext}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  // Cada juego normal (fuera del tie-break) lo decide `probWinGameOnServe`, no el punto
  // suelto — un jugador con 65% de puntos en su saque gana ~83% de sus juegos, no 65%
  // de ellos. Confundir las dos infravalora muchísimo al que saca (bug real, detectado
  // por el test de Fast4: a 3-3 sin tie-break el siguiente juego debe valer
  // `probWinGameOnServe(hold)`, no `hold` a secas).
  const pAWinsGame = aServesNext ? gameHoldA : 1 - gameHoldB;
  const result =
    pAWinsGame * probWinSetFrom(gamesA + 1, gamesB, !aServesNext, pointHoldA, pointHoldB, gameHoldA, gameHoldB, format, memo) +
    (1 - pAWinsGame) * probWinSetFrom(gamesA, gamesB + 1, !aServesNext, pointHoldA, pointHoldB, gameHoldA, gameHoldB, format, memo);
  memo.set(key, result);
  return result;
}

/** Probabilidad de que A gane el set en curso desde el marcador de juegos actual.
 * `holdA`/`holdB` son probabilidades de ganar un PUNTO sacando (lo que trae
 * lib/predictor/serveRate.ts) — la conversión a probabilidad de ganar un JUEGO
 * (`probWinGameOnServe`) pasa aquí dentro, una sola vez. */
export function probWinSet(gamesA: number, gamesB: number, aServesNext: boolean, holdA: number, holdB: number, format: SetFormat): number {
  return probWinSetFrom(gamesA, gamesB, aServesNext, holdA, holdB, probWinGameOnServe(holdA), probWinGameOnServe(holdB), format, new Map());
}

function probWinMatchFromSetsScore(setsA: number, setsB: number, pWinThisSet: number, pWinFreshSet: number, format: SetFormat): number {
  if (setsA >= format.setsToWin) return 1;
  if (setsB >= format.setsToWin) return 0;
  return pWinThisSet * probWinMatchFromSetsScore(setsA + 1, setsB, pWinFreshSet, pWinFreshSet, format) + (1 - pWinThisSet) * probWinMatchFromSetsScore(setsA, setsB + 1, pWinFreshSet, pWinFreshSet, format);
}

/**
 * Probabilidad de que A gane el partido, desde el marcador de sets + el marcador de
 * juegos del set en curso. Cualquier set futuro más allá del actual se trata como un
 * set nuevo (0-0) independiente — no hay forma de saber quién sacaría primero un set
 * que todavía no ha empezado, así que se asume A (una simplificación documentada: en la
 * práctica apenas mueve la cifra, el saque inicial de un set pesa poco frente a ganar
 * el set entero).
 */
export function probWinMatch(setsA: number, setsB: number, gamesA: number, gamesB: number, aServesNext: boolean, holdA: number, holdB: number, format: SetFormat): number {
  if (setsA >= format.setsToWin) return 1;
  if (setsB >= format.setsToWin) return 0;
  const pAWinsCurrentSet = probWinSet(gamesA, gamesB, aServesNext, holdA, holdB, format);
  const pAWinsFreshSet = probWinSet(0, 0, true, holdA, holdB, format);
  return probWinMatchFromSetsScore(setsA, setsB, pAWinsCurrentSet, pAWinsFreshSet, format);
}

export interface LiveWinProbability {
  player1: number;
  player2: number;
}

export interface LiveTourMatchWithPrediction extends LiveTourMatch {
  winProbability: LiveWinProbability;
}

/** Traduce el marcador en vivo (`LiveTourMatch`, ver lib/liveTennis/resolveAgainstOngoing.ts)
 * al estado que pide `probWinMatch`. Si el último set del marcador ya está decidido
 * (partido recién terminado, cache todavía sin refrescar), se trata como 0-0 de juegos
 * de un set nuevo, que es lo que sería el "próximo set" — la propia condición de sets
 * ganados manda igualmente. */
export function computeLiveWinProbability(match: LiveTourMatch, holdA: number, holdB: number): LiveWinProbability {
  const wonSets1 = completedSetWinners(match.player1.setGames, match.player2.setGames);
  const wonSets2 = completedSetWinners(match.player2.setGames, match.player1.setGames);
  const setsA = wonSets1.filter(Boolean).length;
  const setsB = wonSets2.filter(Boolean).length;

  const lastIndex = match.player1.setGames.length - 1;
  const lastSetOpen = lastIndex >= 0 && !wonSets1[lastIndex] && !wonSets2[lastIndex];
  const gamesA = lastSetOpen ? Number(match.player1.setGames[lastIndex]) : 0;
  const gamesB = lastSetOpen ? Number(match.player2.setGames[lastIndex]) : 0;

  const player1 = probWinMatch(setsA, setsB, gamesA, gamesB, match.player1.serving, holdA, holdB, match.format);
  return { player1, player2: 1 - player1 };
}
