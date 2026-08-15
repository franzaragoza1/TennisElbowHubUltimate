/**
 * Orden cronológico de un partido dentro de SU PROPIA edición, para desempatar listas
 * ya agrupadas por torneo (semana/año) — nunca para comparar rondas entre dos
 * ediciones distintas (un cuadro de 128 y uno de 32 no tienen la misma profundidad de
 * "R1").
 *
 * Verificado contra los valores reales en `matches.round` (`SELECT round, count(*)
 * FROM matches GROUP BY round`): Q1/Q2/Q3 son rondas de clasificación (antes del
 * cuadro principal), 'Q' a secas es cuartos de final — dos cosas distintas a pesar del
 * nombre parecido. Cualquier código no listado aquí se manda al final (mejor visible al
 * final de la lista que roto el orden de lo demás).
 */
const ROUND_ORDER: Record<string, number> = {
  Q1: 0,
  Q2: 1,
  Q3: 2,
  R1: 3,
  R2: 4,
  R3: 5,
  R4: 6,
  Q: 7,
  S: 8,
  F: 9,
};

export function roundOrderRank(round: string): number {
  return ROUND_ORDER[round] ?? Number.POSITIVE_INFINITY;
}

/**
 * Comparador para una lista ya agrupada por torneo (mismo año + semana): dentro de
 * cada grupo, ordena de la ronda más temprana a la más tardía (R1 -> ... -> F), sin
 * tocar el orden de qué torneo va primero (eso lo decide quien llame, año/semana
 * descendente normalmente).
 */
export function compareByRoundProgression(roundA: string, roundB: string): number {
  return roundOrderRank(roundA) - roundOrderRank(roundB);
}

/**
 * Etiqueta corta "de toda la vida" para un código de ronda suelto (sin el resto del
 * cuadro delante, a diferencia de `roundDisplayLabel` en `lib/bracket.ts`, que necesita
 * la secuencia completa de rondas de esa edición para calcular por posición desde la
 * Final). Válido porque `Q`/`S`/`F` significan siempre cuartos/semis/final en esta
 * fuente, sea cual sea el tamaño del cuadro (docs/estructura.md §3: en un cuadro de 8
 * el primer partido ya sale etiquetado `Q`, no `R1`) — así que no hace falta conocer el
 * cuadro entero para saber qué significa el código de una ronda concreta.
 */
const ROUND_LABELS: Record<string, string> = {
  Q: "QF",
  S: "SF",
  F: "F",
};

export function roundLabel(round: string): string {
  return ROUND_LABELS[round] ?? round;
}
