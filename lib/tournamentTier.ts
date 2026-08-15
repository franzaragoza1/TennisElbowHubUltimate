/**
 * Peso visual de la tarjeta de torneo, para el calendario del índice de torneos.
 * Verificado contra los valores reales de `editions.category` (`SELECT category,
 * count(*) FROM editions GROUP BY category`): '250', '500', 'Masters 1000',
 * 'Grand Slam', 'Future', 'CT 80/90/100/125', 'Exhibition' — nada de eso coincide con
 * el "GS/M1000/500/250" abreviado de CLAUDE.md §3, así que la comparación es por el
 * texto real, no por un código corto inventado.
 */
export type TournamentTier = "large" | "medium-large" | "medium" | "small";

/** Orden ascendente de peso — de menor a mayor, para que "los grandes van a la
 * derecha" sea simplemente ordenar la semana con esta clave y pintar en fila. */
export const TIER_WEIGHT: Record<TournamentTier, number> = {
  small: 0,
  medium: 1,
  "medium-large": 2,
  large: 3,
};

export function tournamentTier(category: string): TournamentTier {
  if (category === "Grand Slam") return "large";
  if (category === "Masters 1000") return "medium-large";
  if (category === "500" || category === "250") return "medium";
  return "small"; // CT 80/90/100/125, Future, Exhibition, y cualquier categoría futura sin clasificar
}
