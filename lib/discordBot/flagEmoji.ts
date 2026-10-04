/**
 * Código ISO de 2 letras (ver lib/countryCodes.ts::getCountryCode) -> emoji de bandera
 * real de Discord/Unicode — truco estándar: cada letra se traduce a su símbolo
 * indicador regional (U+1F1E6 = 'A', de ahí el desplazamiento fijo de 127397 =
 * 0x1F1E6 - 65). Pura, sin tabla que mantener — cualquier código ISO de 2 letras
 * produce la bandera correcta sola, a diferencia de `CountryFlag.tsx` (la web), que
 * necesita un SVG propio por país porque ahí el emoji no es una opción fiable entre
 * fuentes/SO.
 */
export function countryCodeToFlagEmoji(code: string): string {
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}
