/**
 * Colorea un número de "My Stats" (/account) de rojo a verde según lo bueno que sea
 * el valor — pedido explícito del propietario. Usa los mismos tokens de color que ya
 * pinta subidas/bajadas de ranking (`--up`/`--down`, ver app/globals.css), así que
 * respeta el tema claro/oscuro sin duplicar ningún hex aquí: `color-mix` interpola
 * entre los dos en el propio navegador.
 *
 * Cada rango (`worst`→`best`) es una calibración manual de qué es "malo" y "bueno"
 * para ESTE dato de tenis concreto — un 70% de primeros saques no significa lo mismo
 * que un 70% de puntos de resto ganados, así que no hay una única escala 0-100 que
 * valga para todos. `worst` puede ser mayor que `best` (p. ej. dobles faltas: menos es
 * mejor) y la interpolación funciona igual en ambos sentidos.
 */
export interface StatRange {
  worst: number;
  best: number;
}

export const MY_STATS_RANGES = {
  winPct: { worst: 0, best: 100 },
  firstServePct: { worst: 40, best: 75 },
  firstServeWonPct: { worst: 50, best: 85 },
  secondServeWonPct: { worst: 35, best: 65 },
  returnPointsWonPct: { worst: 20, best: 50 },
  breakPointsWonPct: { worst: 20, best: 60 },
  acesPerMatch: { worst: 0, best: 15 },
  doubleFaultsPerMatch: { worst: 8, best: 0 },
  fastestServeKmh: { worst: 180, best: 230 },
} satisfies Record<string, StatRange>;

/** 0 = tan malo como `worst` o peor, 1 = tan bueno como `best` o mejor — recortado a
 * ese rango, nunca extrapolado más allá. */
function goodness(value: number, { worst, best }: StatRange): number {
  if (best === worst) return 0.5;
  const raw = (value - worst) / (best - worst);
  return Math.max(0, Math.min(1, raw));
}

/** `null` (dato ausente) no se colorea — el tile ya muestra un guion, no un número del
 * que pueda opinar nada. */
export function statColor(value: number | null, range: StatRange): string | undefined {
  if (value === null) return undefined;
  const pct = Math.round(goodness(value, range) * 100);
  return `color-mix(in srgb, var(--down) ${100 - pct}%, var(--up) ${pct}%)`;
}
