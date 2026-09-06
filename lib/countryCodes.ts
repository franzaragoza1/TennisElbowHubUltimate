/**
 * `players.country` es texto libre tal como lo escribió cada usuario en el foro:
 * mayúsculas inconsistentes, nombre de ciudad en vez de país, abreviaturas, y en
 * varios casos texto corrupto de origen (confirmado en el propio HTML archivado, no
 * es un fallo nuestro de codificación) — p. ej. "TÃ¼rkiye" en vez de "Türkiye", con las
 * mismas cadenas de bytes ya rotas en la página real de Mana Games.
 *
 * Este mapa cubre los valores que aparecen de verdad en los jugadores ya cargados
 * (ver `docs/estructura.md`). Lo que no esté aquí sale sin bandera — no se inventa.
 */

function repairMojibake(s: string): string {
  // UTF-8 interpretado como Latin-1 y vuelto a codificar: reversible byte a byte.
  if (!/[ÃÅÎð]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((ch) => ch.charCodeAt(0)));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return repaired;
  } catch {
    return s;
  }
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

const COUNTRY_TO_ISO: Record<string, string> = {
  poland: "PL",
  "united states": "US",
  usa: "US",
  us: "US",
  "united states of america": "US",
  // "U.S." normaliza a "u s" (los puntos se convierten en espacio, no se descartan) —
  // confirmado como valor real de `players.country`, no una variante hipotética.
  "u s": "US",
  france: "FR",
  spain: "ES",
  espana: "ES",
  argentina: "AR",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  london: "GB",
  londom: "GB",
  edinburgh: "GB",
  australia: "AU",
  sydney: "AU",
  wollongong: "AU",
  china: "CN",
  shanghai: "CN",
  serbia: "RS",
  belgrade: "RS",
  brazil: "BR",
  brasil: "BR",
  "sao paulo": "BR",
  italy: "IT",
  italia: "IT",
  milan: "IT",
  rome: "IT",
  portugal: "PT",
  porto: "PT",
  romania: "RO",
  canada: "CA",
  russia: "RU",
  "russian federation": "RU",
  ru: "RU",
  croatia: "HR",
  chile: "CL",
  santiago: "CL",
  philippines: "PH",
  germany: "DE",
  deutschland: "DE",
  ger: "DE",
  berlin: "DE",
  finland: "FI",
  colombia: "CO",
  greece: "GR",
  rhodes: "GR",
  athens: "GR",
  elláda: "GR",
  ellada: "GR",
  slovakia: "SK",
  bratislava: "SK",
  bulgaria: "BG",
  "czech republic": "CZ",
  czechia: "CZ",
  austria: "AT",
  norway: "NO",
  uruguay: "UY",
  morocco: "MA",
  casablanca: "MA",
  india: "IN",
  tunisia: "TN",
  tunisie: "TN",
  turkey: "TR",
  turkiye: "TR",
  hungary: "HU",
  japan: "JP",
  switzerland: "CH",
  "bosnia and herzegovina": "BA",
  sweden: "SE",
  netherlands: "NL",
  macedonia: "MK",
  "puerto rico": "PR",
  ireland: "IE",
  "saudi arabia": "SA",
  algeria: "DZ",
  israel: "IL",
  "tel aviv": "IL",
  georgia: "GE",
  belgium: "BE",
  paris: "FR",
  chambery: "FR",
  slovenia: "SI",
  jesenice: "SI",
  vietnam: "VN",
  "viet nam": "VN",
  "south africa": "ZA",
  indonesia: "ID",
  jakarta: "ID",
  taiwan: "TW",
  "taiwan roc": "TW",
  egypt: "EG",
  cairo: "EG",
  mexico: "MX",
  belarus: "BY",
  gomel: "BY",
  nepal: "NP",
  malaysia: "MY",
  "hong kong": "HK",
  hk: "HK",
  kenya: "KE",
  barbados: "BB",
  bermuda: "BM",
  peru: "PE",
  lima: "PE",
  guyana: "GY",
  latvia: "LV",
  iran: "IR",
  lebanon: "LB",
  "costa rica": "CR",
  denmark: "DK",
  "sri lanka": "LK",
  ecuador: "EC",
  "republic of moldova": "MD",
  honduras: "HN",
  "dominican republic": "DO",
  guatemala: "GT",
  venezuela: "VE",
  madrid: "ES",
  sevilla: "ES",
  bahrain: "BH",
  lithuania: "LT",
  azerbaijan: "AZ",
  saudi: "SA",
  ksa: "SA", // "Kingdom of Saudi Arabia" — abreviatura real vista en producción
};

/** Country name (tal como viene de la fuente) -> código ISO-3166 alpha-2, o null si no se reconoce. */
export function getCountryCode(rawCountry: string | null | undefined): string | null {
  if (!rawCountry) return null;

  const repaired = repairMojibake(rawCountry);
  const wholeNormalized = normalize(repaired);
  // "Ciudad - País" o "País - Ciudad": probamos cada trozo por separado — conserva
  // frases de varias palabras enteras ("united states"), a diferencia del último
  // recurso de abajo.
  const hyphenParts = repaired.split(/[-/]/).map((p) => normalize(p)).filter(Boolean);
  for (const part of [wholeNormalized, ...hyphenParts]) {
    if (part in COUNTRY_TO_ISO) return COUNTRY_TO_ISO[part];
  }

  // Último recurso, sin separador reconocible de por medio ("Chambery France", "Miami
  // USA", "Bulgaria Kyustendil"): cada palabra suelta del texto normalizado, por si
  // alguna sola ya es una entrada del mapa. Nunca gana a una frase completa de arriba
  // (probada antes), así que "united states" sigue resolviendo entero y no como
  // "united" + "states" sueltos (ninguno de los dos es una clave por separado).
  for (const word of wholeNormalized.split(" ")) {
    if (word && word in COUNTRY_TO_ISO) return COUNTRY_TO_ISO[word];
  }
  return null;
}

/** Nombre canónico en inglés para un código ya resuelto — para un filtro/desplegable,
 * nunca para pintar debajo de un nombre de jugador (ahí sigue mandando el texto tal
 * cual vino de la fuente, ver `players.country`). Solo cubre los códigos que de verdad
 * salen de `COUNTRY_TO_ISO`; un código no reconocido devuelve el código tal cual en vez
 * de romper — no debería pasar nunca desde `getCountryCode`, pero un código pasado a
 * mano sí podría no estar. */
const ISO_TO_NAME: Record<string, string> = {
  PL: "Poland", US: "United States", FR: "France", ES: "Spain", AR: "Argentina",
  GB: "United Kingdom", AU: "Australia", CN: "China", RS: "Serbia", BR: "Brazil",
  IT: "Italy", PT: "Portugal", RO: "Romania", CA: "Canada", RU: "Russia",
  HR: "Croatia", CL: "Chile", PH: "Philippines", DE: "Germany", FI: "Finland",
  CO: "Colombia", GR: "Greece", SK: "Slovakia", BG: "Bulgaria", CZ: "Czech Republic",
  AT: "Austria", NO: "Norway", UY: "Uruguay", MA: "Morocco", IN: "India",
  TN: "Tunisia", TR: "Turkey", HU: "Hungary", JP: "Japan", CH: "Switzerland",
  BA: "Bosnia and Herzegovina", SE: "Sweden", NL: "Netherlands", MK: "North Macedonia",
  PR: "Puerto Rico", IE: "Ireland", SA: "Saudi Arabia", DZ: "Algeria", IL: "Israel",
  GE: "Georgia", BE: "Belgium", SI: "Slovenia", VN: "Vietnam", ZA: "South Africa",
  ID: "Indonesia", TW: "Taiwan", EG: "Egypt", MX: "Mexico", BY: "Belarus",
  NP: "Nepal", MY: "Malaysia", HK: "Hong Kong", KE: "Kenya", BB: "Barbados",
  BM: "Bermuda", PE: "Peru", GY: "Guyana", LV: "Latvia", IR: "Iran",
  LB: "Lebanon", CR: "Costa Rica", DK: "Denmark", LK: "Sri Lanka", EC: "Ecuador",
  MD: "Moldova", HN: "Honduras", DO: "Dominican Republic", GT: "Guatemala",
  VE: "Venezuela", BH: "Bahrain", LT: "Lithuania", AZ: "Azerbaijan",
};

export function getCountryName(code: string): string {
  return ISO_TO_NAME[code] ?? code;
}

export interface CountryFilterOption {
  /** Valor a usar en la URL/`<Select>` — el código ISO si se reconoció, si no el texto
   * en bruto tal cual (nunca se adivina un código para algo que no se reconoce). */
  value: string;
  label: string;
  /** null cuando no se reconoció — el filtro no pinta bandera en ese caso. */
  code: string | null;
}

/**
 * Agrupa variantes del mismo país ("USA", "U.S.", "United States", "Texas - USA"...)
 * bajo una sola entrada de filtro — sin esto, un desplegable de país listaba cada
 * cadena en bruto por separado, con muchísimo duplicado real (pedido explícito tras
 * verlo en producción). Lo que no se reconoce NUNCA se fusiona con otra cosa a ciegas
 * — se queda con su propio texto en bruto como entrada independiente, nunca se
 * descarta en silencio.
 */
export function groupCountriesForFilter(countries: (string | null | undefined)[]): CountryFilterOption[] {
  const byValue = new Map<string, CountryFilterOption>();
  for (const raw of countries) {
    if (!raw) continue;
    const code = getCountryCode(raw);
    const value = code ?? raw;
    if (!byValue.has(value)) {
      byValue.set(value, { value, label: code ? getCountryName(code) : raw, code });
    }
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Mismo criterio de agrupación que `groupCountriesForFilter`, para comparar el país
 * de una fila contra el `value` elegido en el filtro — dos variantes del mismo país
 * deben coincidir aunque su texto en bruto sea distinto. */
export function countryMatchesFilter(rawCountry: string | null, filterValue: string): boolean {
  if (!rawCountry) return false;
  const code = getCountryCode(rawCountry);
  return (code ?? rawCountry) === filterValue;
}
