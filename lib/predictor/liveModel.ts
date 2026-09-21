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

/** Cuánto se aleja `holdA`/`holdB` (más abajo) de la media neutra hacia cada lado, como
 * mucho — de sobra para representar hasta la mayor brecha de elo real vista en vivo
 * (`probWinMatch` ya satura de sobra antes de llegar aquí, así que el límite en sí casi
 * nunca se alcanza; solo evita que la búsqueda binaria se vaya a un hold sin sentido,
 * ej. negativo, con un gap de elo absurdo). */
const MAX_HOLD_DELTA = 0.3;
/** Iteraciones de sobra para que la búsqueda binaria converja muy por debajo de
 * cualquier precisión que le importe a un `Math.round(... * 100)` de un %. */
const HOLD_SEARCH_ITERATIONS = 40;

/** Probabilidad estándar de elo (la misma fórmula logística que usan ajedrez y la
 * mayoría de trackers de tenis con rating propio): 1 / (1 + 10^(-(eloA-eloB)/400)). */
export function eloWinProbability(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** (-(eloA - eloB) / 400));
}

/**
 * Reparto de hold rate (holdA, holdB), a cada lado de `neutral`, que reproduce
 * `targetProb` para A en un partido fresco (0-0) de este `format` — usando el propio
 * `probWinMatch` de arriba, el mismo modelo que ya evalúa el marcador real. No es
 * invertible en forma cerrada (depende del formato, del tie-break...), pero SÍ es
 * monótono en el reparto: más holdA/menos holdB nunca baja la probabilidad de A. Eso
 * basta para resolverlo por búsqueda binaria en vez de una fórmula cerrada.
 */
function holdsForTargetProbability(targetProb: number, neutral: number, format: SetFormat): { holdA: number; holdB: number } {
  let lo = -MAX_HOLD_DELTA;
  let hi = MAX_HOLD_DELTA;
  for (let i = 0; i < HOLD_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const p = probWinMatch(0, 0, 0, 0, true, neutral + mid, neutral - mid, format);
    if (p < targetProb) lo = mid;
    else hi = mid;
  }
  const delta = (lo + hi) / 2;
  return { holdA: neutral + delta, holdB: neutral - delta };
}

/** Pedido explícito del propietario, 2026-09-22: "remember ELO is VERY, VERY important
 * and indicative" — 78% del reparto final viene del elo, el 22% restante es lo que ya
 * había (el propio historial de saque de cada jugador, lib/predictor/serveRate.ts).
 * Nunca 100%: un jugador puede tener una racha de saque genuinamente distinta a su elo
 * de toda la vida, y el propio marcador real (fuera de esta función, ver
 * `computeLiveWinProbability`) ya se encarga de que un partido muy avanzado deje de
 * importarle a esto casi nada de todas formas. */
const ELO_BLEND_WEIGHT = 0.78;

/**
 * Mezcla el elo de live-tennis.cn (`lib/liveTennis/parseLivePage.ts` ya lo trae, antes
 * se descartaba al aislar el nombre) en el hold rate de cada jugador ANTES de
 * `computeLiveWinProbability` — el marcador real (sets/juegos ya ganados) sigue
 * mandando exactamente igual que siempre, esto solo mejora la estimación de "qué tan
 * bueno es cada uno" que alimenta ese cálculo. Sin esto, un partido recién empezado
 * (0-0) dependía solo del propio `getPlayerServeWinRate` de cada jugador — su historial
 * de saque en SUS partidos anteriores, con toda su varianza de muestra pequeña — en vez
 * de algo que de verdad mida a los dos entre sí.
 *
 * `neutral` (el punto de partida sin elo) es la media de los dos holds propios, no un
 * 50% fijo: mantiene el nivel real de saque de ESTE partido concreto (un partido entre
 * dos sacadores flojos no debería, por elo, acabar con holds de sacador de elite).
 *
 * Sin elo de alguno de los dos (jugador no encontrado en live-tennis.cn, o sin rating
 * todavía) devuelve los holds tal cual — nunca inventa un elo que no está.
 */
export function blendHoldRatesWithElo(holdA: number, holdB: number, eloA: number | null, eloB: number | null, format: SetFormat): { holdA: number; holdB: number } {
  if (eloA === null || eloB === null) return { holdA, holdB };

  const neutral = (holdA + holdB) / 2;
  const targetProb = eloWinProbability(eloA, eloB);
  const eloHolds = holdsForTargetProbability(targetProb, neutral, format);

  return {
    holdA: holdA * (1 - ELO_BLEND_WEIGHT) + eloHolds.holdA * ELO_BLEND_WEIGHT,
    holdB: holdB * (1 - ELO_BLEND_WEIGHT) + eloHolds.holdB * ELO_BLEND_WEIGHT,
  };
}
