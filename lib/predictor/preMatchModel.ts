/**
 * Fórmula de Win% previa al partido — pesos fijos, elegidos a mano y documentados
 * (nunca un modelo entrenado, ver el "Context" del plan y lib/h2hNarrative.ts: los
 * números los calcula código de verdad, nunca se le piden a un modelo). Cada factor
 * llega ya normalizado a [-1, 1] via `tanh`, así que los pesos son directamente
 * comparables entre sí y fáciles de reajustar más adelante sin tocar nada más.
 */
export interface PreMatchFactors {
  /** tanh((puntosJugador1 - puntosJugador2) / NORMALIZER). 0 si alguno no tiene
   * ranking vigente — nunca un rank inventado. */
  rankingGapScore: number;
  /** tanh((victoriasH2H1 - victoriasH2H2) / (totalEnfrentamientos + k)). 0 sin
   * enfrentamientos previos. */
  h2hScore: number;
  /** tanh(pctVictoriasRecientes1 - pctVictoriasRecientes2), últimos N partidos de cada
   * uno (independientes entre sí, no solo los suyos entre ellos). */
  recentFormScore: number;
  /** tanh(pctVictoriasCarrera1 - pctVictoriasCarrera2). */
  surfaceScore: number;
}

/**
 * Reajustado 2026-09-18 (pedido explícito del propietario: un H2H parejo de verdad,
 * 3-3, seguía saliendo 75/25 solo por la diferencia de ranking, "not accurate"). El
 * ranking pesaba el doble que el propio historial entre esos dos jugadores — el
 * factor más directo que existe sobre ESE enfrentamiento en concreto quedaba
 * ahogado por un factor más genérico. Ahora el H2H pesa más que el ranking, y la
 * forma reciente sube para compensar el hueco.
 */
const WEIGHTS = {
  rankingGap: 0.35,
  h2h: 0.4,
  recentForm: 0.2,
  surface: 0.05,
};

/** Multiplica el score combinado antes de la logística — sube el rango de
 * probabilidades alcanzable para diferencias grandes (sin esto, con factores en
 * [-1,1] y estos pesos, el máximo teórico se queda en un ~73/27 aunque una pareja sea
 * totalmente dispar). Constante ajustable a mano, no aprendida. Bajado de 3 a 2.2 en el
 * mismo reajuste de 2026-09-18 — con el peso de ranking ya reducido, un 3 seguía dando
 * predicciones más seguras de lo que los factores de entrada realmente justifican. */
const SCALE = 2.2;

export interface WinProbability {
  player1: number;
  player2: number;
}

export function computeWinProbability(factors: PreMatchFactors): WinProbability {
  const score =
    WEIGHTS.rankingGap * factors.rankingGapScore +
    WEIGHTS.h2h * factors.h2hScore +
    WEIGHTS.recentForm * factors.recentFormScore +
    WEIGHTS.surface * factors.surfaceScore;

  const player1 = 1 / (1 + Math.exp(-SCALE * score));
  return { player1, player2: 1 - player1 };
}
