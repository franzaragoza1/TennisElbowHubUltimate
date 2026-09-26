/**
 * Clave estable del enlace a la ficha de un cruce SIN jugar. El id de `pending_slots` NO
 * sirve como enlace: cada recarga de la edición (loadTournament.ts) borra y reinserta
 * todos sus huecos, así que cada import les da ids nuevos — cualquier enlace ya
 * generado (página en caché ISR, pestaña abierta, enlace compartido) acababa en 404
 * (bug real reportado, 2026-09-26: "match stats buttons on unplayed matches bring
 * nowhere"). Ronda + pareja de jugadores sí sobrevive a una recarga — mismo criterio
 * que `matchDetailHref` en MatchCard.tsx para los partidos ya jugados (2026-09-22).
 */
export function previewKey(round: string, player1Id: number, player2Id: number): string {
  const [a, b] = [player1Id, player2Id].sort((x, y) => x - y);
  return `${round}-${a}-${b}`;
}

export type PreviewKey = { kind: "id"; id: number } | { kind: "pair"; round: string; a: number; b: number };

/** Lee el segmento de la URL: un número suelto es un enlace ANTIGUO por id de hueco (se
 * sigue aceptando mientras ese id exista); `ronda-a-b` es la clave estable. */
export function parsePreviewKey(raw: string): PreviewKey | null {
  if (/^\d+$/.test(raw)) return { kind: "id", id: Number(raw) };
  const m = /^(.+)-(\d+)-(\d+)$/.exec(raw);
  if (!m) return null;
  return { kind: "pair", round: m[1], a: Number(m[2]), b: Number(m[3]) };
}
