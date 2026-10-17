/**
 * Plan de "qué cambia" al recargar un torneo ya importado (2026-10-17, ver
 * docs/decisiones.md): antes cada recarga (cada 10 min mientras el torneo sigue en juego)
 * BORRABA todos sus partidos y huecos pendientes y los volvía a insertar con ids nuevos —
 * y con ellos se iban, en cascada, las estadísticas de MatchLog (`match_stats`), las
 * previews (`match_previews`) y los enlaces de vídeos/premios a esos partidos.
 *
 * Ahora cada fila se identifica por una clave estable y se actualiza en su sitio; solo
 * se borra lo que de verdad ya no está en la página (una corrección de Mana Games).
 */
export interface ReconcilePlan<E, I> {
  /** Fila existente que sigue en la página: se actualiza conservando su id. */
  updates: { existing: E; incoming: I }[];
  inserts: I[];
  deletes: E[];
}

export function planReconcile<E, I>(existing: E[], incoming: I[], keyOfExisting: (e: E) => string, keyOfIncoming: (i: I) => string): ReconcilePlan<E, I> {
  const byKey = new Map<string, E[]>();
  for (const e of existing) {
    const k = keyOfExisting(e);
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  const updates: ReconcilePlan<E, I>["updates"] = [];
  const inserts: I[] = [];
  for (const i of incoming) {
    const bucket = byKey.get(keyOfIncoming(i));
    const match = bucket?.shift();
    if (match) updates.push({ existing: match, incoming: i });
    else inserts.push(i);
  }
  const deletes = [...byKey.values()].flat();
  return { updates, inserts, deletes };
}

/** Un partido de un cuadro: misma ronda y los mismos dos jugadores (en cualquier orden). */
export function matchKey(round: string, player1Id: number | null, player2Id: number | null): string {
  const [a, b] = [player1Id ?? 0, player2Id ?? 0].sort((x, y) => x - y);
  return `${round}|${a}|${b}`;
}

/** Un hueco pendiente: su posición en el cuadro (los jugadores pueden llegar después). */
export function pendingKey(round: string, sortIndex: number): string {
  return `${round}|${sortIndex}`;
}
