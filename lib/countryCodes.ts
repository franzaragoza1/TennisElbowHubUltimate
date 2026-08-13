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
};

/** Country name (tal como viene de la fuente) -> código ISO-3166 alpha-2, o null si no se reconoce. */
export function getCountryCode(rawCountry: string | null | undefined): string | null {
  if (!rawCountry) return null;

  const repaired = repairMojibake(rawCountry);
  // "Ciudad - País" o "País - Ciudad": probamos cada trozo por separado.
  const parts = repaired.split(/[-/]/).map((p) => normalize(p)).filter(Boolean);
  for (const part of [normalize(repaired), ...parts]) {
    if (part in COUNTRY_TO_ISO) return COUNTRY_TO_ISO[part];
  }
  return null;
}
