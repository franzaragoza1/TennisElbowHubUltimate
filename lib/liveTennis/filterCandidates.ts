import type { RawLiveMatch } from "./parseLivePage";

/**
 * Primeros dos de los tres criterios pedidos para distinguir un partido del tour XKT
 * del resto de partidos TE4 en vivo que trae live-tennis.cn: formato a tres sets
 * ("三盘两胜" en la fuente — se usa el atributo `best-of="3"` del DOM en vez de
 * comparar el texto en chino, mismo dato, más resistente a cambios de redacción) y
 * pista/skin real del tour (`public/surfaces.txt`). El tercer criterio (cruce real en
 * uno de nuestros torneos en curso) necesita base de datos — ver
 * `resolveAgainstOngoing.ts` — así que se queda fuera de esta función a propósito, para
 * que esta parte sea una función pura y comprobable sin tocar la base de datos.
 */
export function filterCandidates(matches: RawLiveMatch[], knownSurfaces: Set<string>): RawLiveMatch[] {
  return matches.filter((m) => m.bestOf === 3 && knownSurfaces.has(m.courtTitle));
}
