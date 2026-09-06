/**
 * Resolución de nombre -> `players.id`, pura (sin tocar la base de datos) para que
 * se pueda testear sin una BD viva — misma separación que el resto del proyecto
 * (p.ej. `lib/liveRanking/roundPoints.ts`). `lib/matchLog/linkToTourMatch.ts`
 * construye el índice de verdad desde la base de datos y es lo único que lo usa.
 *
 * Un jugador puede aparecer en un MatchLog local con un nombre que ya no es su
 * `players.displayName` actual — cambió de nombre en Mana (que sobrescribe el viejo
 * sin dejar histórico) o TE4 lo abrevia. TE4 concretamente abrevia un nombre de dos
 * palabras a "N.Apellido" en varios sitios (MatchLog y también los marcadores en
 * vivo, `lib/liveTennis/nameMatch.ts` — mismo problema, mismo origen).
 */
export interface NameIndex {
  /** Nombre completo en minúsculas -> ids de jugador con ese nombre exacto (por
   * cualquiera de las fuentes que se le hayan pasado a `buildNameIndexFromRows`).
   * Más de un id = ambiguo, nunca se adivina cuál. */
  exact: Map<string, Set<number>>;
  /** Solo nombres de exactamente dos palabras, para la resolución "N.Apellido". */
  twoWord: { playerId: number; firstWord: string; secondWord: string }[];
}

export function buildNameIndexFromRows(rows: { playerId: number; name: string }[]): NameIndex {
  const exact = new Map<string, Set<number>>();
  const twoWord: NameIndex["twoWord"] = [];

  for (const { playerId, name } of rows) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!exact.has(lower)) exact.set(lower, new Set());
    exact.get(lower)!.add(playerId);

    const words = trimmed.split(/\s+/);
    if (words.length === 2) {
      twoWord.push({ playerId, firstWord: words[0].toLowerCase(), secondWord: words[1].toLowerCase() });
    }
  }

  return { exact, twoWord };
}

// "N.Apellido" — una sola letra, un punto (con o sin espacio detrás), luego el
// apellido. Deliberadamente estricto (una sola letra de inicial): un nombre corto
// casual con un punto detrás no debe colarse como si fuera esta abreviatura.
const ABBREVIATED_NAME_RE = /^(\p{L})\.\s*(\p{L}[\p{L}'’-]*)$/u;

/** Resolución exacta primero; si no hay ninguna, se prueba la forma abreviada
 * "N.Apellido" contra los nombres de dos palabras del índice. Cero o más de una
 * coincidencia en cualquiera de los dos pasos se trata como "no se puede resolver"
 * — nunca se adivina cuál es. */
export function resolvePlayerIdFromIndex(index: NameIndex, rawName: string): number | null {
  const trimmed = rawName.trim();
  const exactIds = index.exact.get(trimmed.toLowerCase());
  if (exactIds) return exactIds.size === 1 ? [...exactIds][0] : null;

  const m = ABBREVIATED_NAME_RE.exec(trimmed);
  if (!m) return null;
  const initial = m[1].toLowerCase();
  const surname = m[2].toLowerCase();
  const matches = new Set(
    index.twoWord.filter((c) => c.firstWord.startsWith(initial) && c.secondWord === surname).map((c) => c.playerId),
  );
  return matches.size === 1 ? [...matches][0] : null;
}
