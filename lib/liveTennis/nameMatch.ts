const MIN_MATCHABLE_LENGTH = 3;

// "N.Apellido" — el propio TE4 abreviaba así un nombre de dos palabras en el
// MatchLog local (ver lib/matchLog/nameIndex.ts, mismo motivo aquí: live-tennis.cn
// hereda el nombre tal como lo emite TE4). Una sola letra de inicial a propósito: un
// nombre corto casual con un punto detrás no debe colarse como si fuera esto.
const ABBREVIATED_NAME_RE = /^(\p{L})\.\s*(\p{L}[\p{L}'’-]*)$/u;

/** `short` en forma "N.Apellido" y `full` un nombre real de dos palabras cuya
 * inicial y apellido cuadran. Comparación 1 a 1 (no una búsqueda contra todo el
 * universo de jugadores como en `nameIndex.ts`), así que aquí no hace falta
 * descartar por ambigüedad: solo se comparan los dos nombres que ya se estaban
 * intentando casar. */
function matchesAbbreviatedForm(short: string, full: string): boolean {
  const m = ABBREVIATED_NAME_RE.exec(short.trim());
  if (!m) return false;
  const words = full.trim().split(/\s+/);
  if (words.length !== 2) return false;
  return words[0].toLowerCase().startsWith(m[1].toLowerCase()) && words[1].toLowerCase() === m[2].toLowerCase();
}

/**
 * live-tennis.cn y Mana Games son dos sistemas de nombres independientes — el mismo
 * jugador puede aparecer como un apodo más corto en uno que en el otro (visto en
 * producción: "minato" en live-tennis.cn para el mismo "minatonamikaze1643" de Mana
 * Games), no un error de ninguno de los dos lados. Iguales-a-secas (case-insensitive),
 * uno sustring del otro, o uno la forma abreviada "N.Apellido" del otro, cuentan como
 * el mismo jugador; un nombre de 1-2 caracteres nunca basta por sí solo como
 * sustring (casaría con casi cualquier cosa).
 */
export function namesMatch(a: string, b: string): boolean {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA === lowerB) return true;
  if (matchesAbbreviatedForm(a, b) || matchesAbbreviatedForm(b, a)) return true;
  if (lowerA.length < MIN_MATCHABLE_LENGTH || lowerB.length < MIN_MATCHABLE_LENGTH) return false;
  return lowerA.includes(lowerB) || lowerB.includes(lowerA);
}
