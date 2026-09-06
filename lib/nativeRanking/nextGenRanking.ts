import { rankByPoints, type RankedEntry } from "./officialRanking";

/**
 * Pura, sin base de datos (misma razón que officialRanking.ts). Mismo criterio que
 * el Official Ranking nativo, filtrado a jugadores cuyo `players.startYear` es
 * EXACTAMENTE el año dado (pedido explícito) — no un rango, no "desde". Distinto de
 * `firstSeenYear` (lib/h2hStats.ts, derivado del ranking de Mana): no se usa aquí.
 * Re-numera desde 1 sobre el subconjunto ya filtrado, reutilizando `rankByPoints`
 * (misma regla de desempate/rango secuencial, no una reimplementación aparte).
 */
export function filterAndRerankNextGen(
  officialRanked: { playerId: number; points: number }[],
  startYearByPlayer: Map<number, number | null>,
  year: number,
): RankedEntry[] {
  const filtered = officialRanked.filter((entry) => startYearByPlayer.get(entry.playerId) === year);
  return rankByPoints(filtered);
}
