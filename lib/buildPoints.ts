import { FLAT_STAT_KEYS, TIERED_STAT_KEYS, type StatKey } from "./buildStats";

/**
 * El presupuesto real del creador de personaje de TE4 — verificado contra DOS
 * screenshots reales de referencia (2026-09-07): con este presupuesto y la fórmula de
 * abajo, las dos reproducen exactamente 772 puntos restantes, cada una con una
 * distribución de stats completamente distinta. No es una cifra inventada ni una
 * aproximación, está comprobada dos veces contra datos reales.
 */
export const BUILD_POINT_BUDGET = 2800;

/** Un build solo se puede hacer público si le sobran EXACTAMENTE estos puntos —
 * pedido explícito del propietario ("772 Points should always remain, otherwise the
 * build wont be valid to post"). Confirmado con las mismas dos referencias de arriba. */
export const VALID_REMAINING_POINTS = 772;

/**
 * Coste de subir un stat "tiered" de 0 a `value` — pedido explícito, con la
 * puntualización real del propietario sobre dónde cae el punto de corte: subir DE 89
 * A 90 sigue constando 2 (la tarifa del tramo anterior), y el tramo de 3 puntos solo
 * empieza a contar DESDE 90 en adelante (91, 92...). Sin esa puntualización el cálculo
 * daba 746/772 en vez de exactamente 772 contra las dos referencias reales.
 */
function tieredCost(value: number): number {
  const v = Math.max(0, Math.min(100, value));
  if (v <= 60) return v;
  if (v <= 90) return 60 + 2 * (v - 60);
  return 120 + 3 * (v - 90);
}

/**
 * Puntos que le quedan a un build tras repartir el presupuesto entre sus stats —
 * función pura, usable tal cual en el cliente (en vivo, mientras el jugador mueve los
 * sliders) y en el servidor (valor autoritativo al guardar, nunca el que mande el
 * cliente). `topSpin` no aparece aquí a propósito: no cuesta nada, así que no afecta
 * al total pase lo que pase.
 */
export function computeBuildPoints(stats: Partial<Record<StatKey, number | null>>): number {
  let spent = 0;
  for (const key of TIERED_STAT_KEYS) spent += tieredCost(stats[key] ?? 0);
  for (const key of FLAT_STAT_KEYS) spent += Math.max(0, Math.min(100, stats[key] ?? 0));
  return BUILD_POINT_BUDGET - spent;
}
