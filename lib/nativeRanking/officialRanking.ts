export interface RankedEntry {
  playerId: number;
  points: number;
  rank: number;
}

/**
 * Pura, sin base de datos (misma razón que lib/liveRanking/roundPoints.ts: se puede
 * probar sin arrastrar @/db/client — la parte que sí consulta la DB vive en
 * nativeRankings.ts). Orden: puntos descendente, `playerId` ascendente para
 * desempatar de forma estable. Rango SECUENCIAL, nunca compartido (pedido
 * explícito: nada de "T5" estilo ATP).
 */
export function rankByPoints(entries: { playerId: number; points: number }[]): RankedEntry[] {
  return [...entries]
    .sort((a, b) => b.points - a.points || a.playerId - b.playerId)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}
