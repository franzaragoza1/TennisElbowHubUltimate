/**
 * Catálogo fijo de categorías de premios — mensuales y anuales, reemplazando el
 * anuncio manual que antes se publicaba a mano en Discord. Lista cerrada en código,
 * no editable desde el panel de admin (pedido explícito) — mismo criterio que
 * lib/buildStats.ts::ACCELERATION_TRAITS/ARCHETYPES para un vocabulario pequeño y
 * estable que no hace falta convertir en datos.
 *
 * Módulo puro, sin `db` — usable igual desde el servidor, el cliente y los tests.
 */

export type AwardCycle = "monthly" | "yearly";

/** Qué tipo de "quién" se nomina en esta categoría — determina qué campos de
 * award_nominations hacen falta rellenar (ver app/admin/awards/actions.ts):
 * - 'player': un jugador solo, sin partido concreto (p.ej. Sportsmanship, Year-End No.1).
 * - 'player_in_match': un jugador Y el partido en el que ocurrió (p.ej. Point/Upset of
 *   the Month — el punto/la sorpresa pasó EN un partido concreto).
 * - 'match': el partido en sí, sin un jugador protagonista único (Match of the Month/Year). */
export type AwardNomineeKind = "player" | "player_in_match" | "match";

export interface AwardCategory {
  key: string;
  label: string;
  emoji: string;
  cycle: AwardCycle;
  /** Solo true para 'point_of_month' — la única categoría con envío público de clip
   * (app/awards/actions.ts::submitPointOfMonthClip). Todas las demás, incluidas las
   * anuales, las añade un admin directamente sin clip. */
  requiresClip: boolean;
  nomineeKind: AwardNomineeKind;
}

export const AWARD_CATEGORIES: readonly AwardCategory[] = [
  { key: "point_of_month", label: "Point of the Month", emoji: "🔥", cycle: "monthly", requiresClip: true, nomineeKind: "player_in_match" },
  { key: "upset_of_month", label: "Upset of the Month", emoji: "💥", cycle: "monthly", requiresClip: false, nomineeKind: "player_in_match" },
  { key: "match_of_month", label: "Match of the Month", emoji: "⚔️", cycle: "monthly", requiresClip: false, nomineeKind: "match" },
  { key: "year_end_no1", label: "Year-End No. 1", emoji: "🥇", cycle: "yearly", requiresClip: false, nomineeKind: "player" },
  { key: "sportsmanship", label: "Sportsmanship Award", emoji: "🤝", cycle: "yearly", requiresClip: false, nomineeKind: "player" },
  { key: "most_improved", label: "Most Improved Player", emoji: "📈", cycle: "yearly", requiresClip: false, nomineeKind: "player" },
  { key: "newcomer", label: "Newcomer of the Year", emoji: "🌱", cycle: "yearly", requiresClip: false, nomineeKind: "player" },
  { key: "point_of_year", label: "Point of the Year", emoji: "✨", cycle: "yearly", requiresClip: false, nomineeKind: "player_in_match" },
  { key: "upset_of_year", label: "Upset of the Year", emoji: "🎃", cycle: "yearly", requiresClip: false, nomineeKind: "player_in_match" },
  { key: "match_of_year", label: "Match of the Year", emoji: "🏆", cycle: "yearly", requiresClip: false, nomineeKind: "match" },
] as const;

export type AwardCategoryKey = (typeof AWARD_CATEGORIES)[number]["key"];

export function isAwardCategoryKey(key: string): key is AwardCategoryKey {
  return AWARD_CATEGORIES.some((c) => c.key === key);
}

export function getAwardCategory(key: string): AwardCategory | undefined {
  return AWARD_CATEGORIES.find((c) => c.key === key);
}

export function categoriesForCycle(cycle: AwardCycle): AwardCategory[] {
  return AWARD_CATEGORIES.filter((c) => c.cycle === cycle);
}
