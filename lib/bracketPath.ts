/**
 * Recorrido de un jugador por el cuadro — pura, sin React, para la vista compacta
 * (components/tournament/CompactBracket.tsx). Un jugador con id <= 0 (bye, TBD) nunca
 * tiene recorrido.
 */
export interface PathMatch {
  id: number;
  player1Id: number;
  player2Id: number;
}

export function matchIdsInvolving(
  matches: PathMatch[],
  playerId: number | null,
): Set<number> {
  const ids = new Set<number>();
  if (playerId === null || playerId <= 0) return ids;
  for (const m of matches) {
    if (m.player1Id === playerId || m.player2Id === playerId) ids.add(m.id);
  }
  return ids;
}

/** Una línea del cuadro forma parte del recorrido solo si los DOS partidos que une
 * (alimentador y destino) lo incluyen — el jugador ganó el primero y juega el segundo. */
export function isPathConnector(
  c: { fromMatchId?: number; toMatchId?: number },
  involved: Set<number>,
): boolean {
  return (
    c.fromMatchId !== undefined &&
    c.toMatchId !== undefined &&
    involved.has(c.fromMatchId) &&
    involved.has(c.toMatchId)
  );
}
