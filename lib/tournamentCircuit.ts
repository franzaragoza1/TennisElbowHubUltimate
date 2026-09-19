/**
 * A qué circuito pertenece un torneo, a partir de `editions.category` — verificado
 * contra los valores reales (`SELECT DISTINCT category FROM editions`, ver
 * `lib/tournamentTier.ts`): '250','500','Masters 1000','Grand Slam','Exhibition'
 * (circuito principal), 'CT 80/90/100/125' (Challenger), 'Future' (Futures).
 *
 * La propia página de Mana Games (`OT_LastResults.php`) no separa por circuito — es
 * una sola tabla con todo mezclado; esta clasificación es enteramente nuestra, para
 * las pestañas de `/scores` (misma estructura "Tour / Challenger" de la referencia,
 * con una tercera pestaña de Futures que la referencia no tiene pero nuestro tour sí
 * necesita, dado que si hay categoría 'Future' en los datos).
 *
 * "Main Tour", nunca "ATP Tour" — pedido explícito, 2026-09-18: aunque la estructura de
 * pestañas replica la referencia, el nombre del circuito en sí no es nuestro para
 * usarlo (CLAUDE.md §6, "Nombres de patrocinadores reales en cualquier parte de la
 * interfaz" — mismo criterio ya aplicado antes solo en components/players/
 * ActivityFilters.tsx, ahora unificado aquí para las dos franjas).
 */
export type TournamentCircuit = "tour" | "challenger" | "future";

export const CIRCUIT_LABEL: Record<TournamentCircuit, string> = {
  tour: "Main Tour",
  challenger: "Challenger",
  future: "Futures",
};

export function tournamentCircuit(category: string): TournamentCircuit {
  if (category.startsWith("CT ")) return "challenger";
  if (category === "Future") return "future";
  return "tour"; // Grand Slam, Masters 1000, 500, 250, Exhibition
}
