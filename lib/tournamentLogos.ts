/**
 * `events.displayName` -> nombre de carpeta en el material fuente `XKTTBSTD/`
 * (fuera de git, ver .gitignore). Solo el `Icon.png` de cada carpeta listada aquí se
 * copió, aplanado, a `public/tournament-logos/<slug>.png` — ver el script de copia
 * en `docs/decisiones.md`.
 *
 * Tabla verificada a mano contra las carpetas reales, no un emparejamiento
 * automático en tiempo de ejecución: `XKTTBSTD` tiene carpetas por ciudad (variantes
 * ATP/WTA, "Adelaide 2", genéricos como "Madrid" sin categoría...) y adivinar mal
 * pondría el escudo equivocado en un torneo. Los eventos sin carpeta razonable
 * (Albacete, Ankara I, Beach House Exho, Montevideo I, Perth, Verona — no hay ninguna
 * carpeta suya, o la que hay está vacía) se quedan sin logo a propósito. Rome tenía la
 * carpeta vacía en el primer pase (2026-08-14); se rellenó después y se añadió aquí.
 *
 * Grand Slams: el nombre de pista principal, sesión de noche cuando existe esa
 * variante (Australian Open y Roland Garros la tienen; Wimbledon y US Open no, así
 * que se usa su pista central de día).
 */
const TOURNAMENT_LOGO_FOLDER: Record<string, string> = {
  Acapulco: "Acapulco ATP 500",
  Adelaide: "Adelaide ATP 250",
  Antwerp: "Antwerp ATP 250",
  Atlanta: "Atlanta ATP 250",
  Auckland: "Auckland ATP 250",
  "Australian Open": "AO Rod Laver Night",
  "Bad Homburg": "Bad Homburg WTA 250",
  Barcelona: "Barcelona ATP 500",
  Basel: "Basel ATP 500",
  Bastad: "Bastad ATP 250",
  Beijing: "Beijing Lotus ATP 500",
  "Berlin I": "Berlin WTA 500",
  Birmingham: "Birmingham WTA 250",
  Brisbane: "Brisbane ATP 250",
  Bucharest: "Bucharest ATP 250",
  "Buenos Aires": "Buenos Aires ATP 250",
  Charleston: "Charleston WTA 500",
  Chengdu: "Chengdu ATP 250",
  Cincinnati: "Cincinnati ATP 1000",
  Cleveland: "Cleveland WTA 250",
  Cordoba: "Cordoba ATP 250",
  Dallas: "Dallas ATP 250",
  "Delray Beach": "Delray Beach ATP 250",
  Doha: "Doha ATP 250",
  Dubai: "Dubai ATP 500",
  Eastbourne: "Eastbourne ATP 250",
  Estoril: "Estoril ATP 250",
  Geneva: "Geneva ATP 250",
  "Granby I": "Granby WTA 250",
  Gstaad: "Gstaad ATP 250",
  Halle: "Halle ATP 500",
  Hamburg: "Hamburg ATP 500",
  Houston: "Houston ATP 250",
  "Indian Wells": "Indian Wells ATP 1000",
  Kitzbuhel: "Kitzbuhel ATP 250",
  Linz: "Linz WTA 500",
  "Los Cabos": "Los Cabos ATP 250",
  Lyon: "Lyon ATP 250",
  Madrid: "Madrid ATP 1000",
  Mallorca: "Mallorca ATP 250",
  Marrakech: "Marrakech ATP 250",
  "Marseille I": "Marseille ATP 250",
  Metz: "Metz ATP 250",
  Miami: "Miami ATP 1000",
  "Monte-Carlo": "Monte Carlo ATP 1000",
  Montpellier: "Montpellier ATP 250",
  Montreal: "Montreal ATP 1000",
  Moscow: "Moscow ATP 250",
  Munich: "Munich ATP 250",
  Newport: "Newport ATP 250",
  Nottingham: "Nottingham WTA 250",
  Palermo: "Palermo WTA 250",
  Paris: "Paris ATP 1000",
  Prague: "Prague WTA 250",
  Queens: "Queens ATP 500",
  "Rio de Janeiro": "Rio ATP 500",
  "Roland Garros": "RG Philippe Chatrier Night",
  "Roland Garros [TE4]": "RG Philippe Chatrier Night",
  Rome: "Rome ATP 1000",
  Rotterdam: "Rotterdam ATP 500",
  "San Diego": "San Diego ATP 250",
  "San Jose": "San Jose WTA 500",
  Santiago: "Santiago ATP 250",
  Seoul: "Seoul ATP 250",
  Shanghai: "Shanghai ATP 1000",
  Sofia: "Sofia ATP 250",
  Stockholm: "Stockholm ATP 250",
  Stuttgart: "Stuttgart ATP 250",
  Sydney: "Sydney ATP 250",
  "Tel Aviv": "Tel Aviv ATP 250",
  Tokyo: "Tokyo ATP 500",
  Toronto: "Toronto ATP 1000",
  "US Open": "US Open Arthur Ashe",
  Umag: "Umag ATP 250",
  Vienna: "Vienna ATP 500",
  Washington: "Washington ATP 500",
  Wimbledon: "Wimbledon Center Court Day",
  "Winston Salem": "Winston Salem ATP 250",
  Zhuhai: "Zhuhai ATP 250",
  "s'Hertogenbosch": "S'Hertogenbosh ATP 250",
};

export function slugifyLogoFolder(folder: string): string {
  return folder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTournamentLogoUrl(eventName: string): string | null {
  const folder = TOURNAMENT_LOGO_FOLDER[eventName];
  if (!folder) return null;
  return `/tournament-logos/${slugifyLogoFolder(folder)}.png`;
}
