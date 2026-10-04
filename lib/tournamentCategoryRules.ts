/**
 * Elo Limit / Danger Zone por categoría de Challenger y Future — nunca vienen en la
 * página de Mana (confirmado contra `docs/estructura.md`: la tabla de metadatos del
 * torneo no trae ningún campo de reglas, solo Competition/Draw/Queue/Seeds/Surface/
 * Category/Week/Year), así que esto es puro conocimiento del propietario, dado a mano
 * (2026-10-04) — no se puede derivar ni adivinar de los datos scrapeados.
 *
 * El texto que de verdad guarda `editions.category` sigue siendo "CT 125"/"CT 100"/...
 * (confirmado contra datos reales de producción: `["250","500","CT 100","CT 125","CT
 * 80","CT 90","Exhibition","Future","Grand Slam","Masters 1000","Tour Finals"]`) — eso
 * NUNCA se toca, es el dato tal cual lo dio Mana. "CT125 and Challenger 125 are the
 * same thing, so just rename all CT to Challenger" era sobre el texto que se ENSEÑA
 * (mismo criterio que `roundDisplayLabel` traduciendo "Q"/"S"/"F" sin tocar
 * `matches.round`), así que `normalizeCategoryForDisplay` traduce "CT N" -> "Challenger
 * N" solo para mostrar — y esta tabla queda indexada por ese texto YA traducido, para
 * que el nombre que se ve y la clave que se busca sean siempre el mismo. El límite de
 * Elo baja 25 en cada escalón empezando en 1550 para Challenger 125 — no es
 * proporcional a la diferencia numérica del nombre del escalón (125->110 son 15, no
 * 25), es un paso fijo de 25 por posición en la lista.
 */
export interface CategoryRules {
  eloLimit: number;
  dangerZoneAllowed: boolean;
}

const CATEGORY_RULES: Record<string, CategoryRules> = {
  "Challenger 125": { eloLimit: 1550, dangerZoneAllowed: true },
  "Challenger 110": { eloLimit: 1525, dangerZoneAllowed: true },
  "Challenger 100": { eloLimit: 1500, dangerZoneAllowed: true },
  "Challenger 90": { eloLimit: 1475, dangerZoneAllowed: true },
  "Challenger 80": { eloLimit: 1450, dangerZoneAllowed: true },
  "Challenger 75": { eloLimit: 1425, dangerZoneAllowed: true },
  Future: { eloLimit: 750, dangerZoneAllowed: true },
};

/** "CT 100" -> "Challenger 100" — cualquier otra categoría ("500", "Grand Slam",
 * "Future"...) pasa tal cual. Nunca toca el dato guardado en `editions.category`, solo
 * el texto que se enseña/con el que se busca en `getCategoryRules`. */
export function normalizeCategoryForDisplay(category: string): string {
  return category.startsWith("CT ") ? `Challenger ${category.slice(3)}` : category;
}

/** `null` para cualquier categoría sin reglas propias (Grand Slam, Masters 1000, 500,
 * 250, Exhibition...) — esas nunca llevan sección de Notes & Rules. Acepta tanto el
 * texto ya normalizado ("Challenger 100") como el crudo de la base de datos ("CT
 * 100") — normaliza él mismo antes de buscar, para que no haya que acordarse de
 * llamar a `normalizeCategoryForDisplay` primero en cada sitio que use esto. */
export function getCategoryRules(category: string): CategoryRules | null {
  return CATEGORY_RULES[normalizeCategoryForDisplay(category)] ?? null;
}
