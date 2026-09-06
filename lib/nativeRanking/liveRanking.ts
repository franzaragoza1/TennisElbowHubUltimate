/**
 * Pura, sin base de datos (misma razón que officialRanking.ts). Suma los puntos
 * asegurados en ediciones EN CURSO a la base oficial — sin resta de nada, a
 * diferencia de lib/liveRanking/expiringPoints.ts (el motor de Mana): el ranking
 * nativo no tiene snapshot que caduque, es una suma recalculada en cada lectura
 * (ver docs/decisiones.md, "Fresh start"). Un jugador que solo aparece en `ongoing`
 * (debutante, sin puntos oficiales todavía) entra con base 0.
 */
export function mergeOngoingPoints(
  official: { playerId: number; points: number }[],
  ongoing: Map<number, { points: number }>,
): { playerId: number; points: number }[] {
  const seen = new Set(official.map((e) => e.playerId));
  const merged = official.map((entry) => {
    const extra = ongoing.get(entry.playerId);
    return extra ? { ...entry, points: entry.points + extra.points } : entry;
  });
  for (const [playerId, { points }] of ongoing) {
    if (!seen.has(playerId)) merged.push({ playerId, points });
  }
  return merged;
}
