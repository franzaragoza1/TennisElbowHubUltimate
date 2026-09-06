import type { RawLiveMatch } from "./parseLivePage";

const VALID_BEST_OF = new Set([3, 5]);

/**
 * Primeros dos de los tres criterios pedidos para distinguir un partido del tour XKT
 * del resto de partidos TE4 en vivo que trae live-tennis.cn: formato de nuestro tour
 * (al mejor de 3 — la mayoría de rondas — o al mejor de 5 — categoría GS y Next Gen
 * Finals, ver lib/tennisScore.ts/lib/finals/format.ts; se usa el atributo `best-of`
 * del DOM en vez de comparar el texto en chino, mismo dato, más resistente a cambios
 * de redacción) y pista/skin real del tour (`public/surfaces.txt`). El tercer
 * criterio (cruce real en uno de nuestros torneos en curso) necesita base de datos —
 * ver `resolveAgainstOngoing.ts` — así que se queda fuera de esta función a propósito,
 * para que esta parte sea una función pura y comprobable sin tocar la base de datos.
 */
export function filterCandidates(matches: RawLiveMatch[], knownSurfaces: Set<string>): RawLiveMatch[] {
  return matches.filter((m) => VALID_BEST_OF.has(m.bestOf) && knownSurfaces.has(m.courtTitle));
}
