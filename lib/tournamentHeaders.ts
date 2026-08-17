/**
 * `events.displayName` -> fichero en `public/assets/headers/` (fotos de sede/estadio
 * puestas ahí a mano, fuera del backfill). Tabla verificada una a una contra los
 * ficheros reales, mismo criterio que `lib/tournamentLogos.ts`: nada de adivinar por
 * similitud de texto en tiempo de ejecución, y los eventos sin foto razonable se
 * quedan sin cabecera a propósito en vez de arriesgar una equivocada.
 *
 * Ficheros del lote que NO se han mapeado a ningún evento:
 * - `tour-finals.jpg`: renombrado de `nitto-atp-finals_tournimage_2024.jpg`, pero es
 *   la MISMA foto — se comprobó de nuevo tras el renombre y sigue cubierta del lockup
 *   "Nitto ATP Finals" (marcador central, vallas, "INTESA SANPAOLO HOST PARTNER OF
 *   THE Nitto ATP FINALS"). Cambiar el nombre del fichero no cambia lo que hay en la
 *   foto — sigue siendo justo lo que CLAUDE.md §6 prohíbe explícitamente por nombre
 *   ("Nada de eso entra en el repo"). Ni "Tour Finals" ni "Next Gen Finals" tienen
 *   cabecera por este motivo; haría falta una foto de sede sin ese rótulo.
 * - `almaty_tournimage_2024.jpg`, `hangzhou-2024-announcement.jpg`,
 *   `hong-kong-2024-tournament-image.jpg`: ningún evento de este tour se llama así.
 * - `houston_tournimage_2019 (1).jpg`: duplicado exacto de `houston_tournimage_2019.jpg`.
 *
 * `montreal-stadium-shot-2023.jpg` sustituyó a `toronto-stadium-shot-2023.jpg` (el
 * Masters de Canadá alterna sede Montreal/Toronto año a año — el fichero se
 * renombró para reflejar cuál de las dos sedes es de verdad la foto); Toronto se
 * queda sin cabecera por ahora, Montreal la tiene.
 */
const TOURNAMENT_HEADER_FILE: Record<string, string> = {
  Acapulco: "acapulco-tournament-page-2022.jpg",
  Adelaide: "adelaide_2_tournimage_2022.jpg",
  Antwerp: "antwerp_tournimage_2019.jpg",
  Auckland: "auckland-tournament-page.jpg",
  "Australian Open": "australian-open-2023-tournament-image.jpg",
  Barcelona: "barcelona_tournimage_2019.jpg",
  Basel: "basel-2022-tournament-profile.jpg",
  Bastad: "bastad_tournimage_2022.jpg",
  Beijing: "beijing_tournimage_16_2_1920x1015.jpg",
  Brisbane: "brisbane_tournimage_16_1920x1015.jpg",
  Bucharest: "bucharest_tournimage_2025.jpg",
  "Buenos Aires": "buenosaires_tournimage_2019.jpg",
  Chengdu: "chengdu-2025-stadium-shot.jpg",
  Cincinnati: "cincinnati_tournimage_2022.jpg",
  Dallas: "dallas_tournimage_2021.jpg",
  "Delray Beach": "delray-beach_tournimage_2026.jpg",
  Doha: "doha_tournimage19.jpg",
  Dubai: "dubai_tournimage_2020.jpg",
  Eastbourne: "eastbourne-tournament-profile-2022.jpg",
  Estoril: "estorilch-2025-venue.jpg",
  Geneva: "geneva2021.jpg",
  Gstaad: "gstaad_tournimage_2019_v1.jpg",
  Halle: "halle_tournimage_2023.jpg",
  Hamburg: "hamburg_tournimage_2019.jpg",
  Houston: "houston_tournimage_2019.jpg",
  "Indian Wells": "indian-wells-2022-tournament-photo.jpg",
  Kitzbuhel: "kitzbuhel-2016-profile-.jpg",
  // Libema Open es el nombre real (con patrocinador) del ATP 250 de 's-Hertogenbosch.
  "s'Hertogenbosch": "libema-open-tournament-profile-image-2022.jpg",
  "Los Cabos": "los-cabos-tournament-page.jpg",
  Madrid: "madrid_tournimage_2019_night.jpg",
  Mallorca: "mallorca_tournimage_2025.jpg",
  Marrakech: "marrakech_tournimage_2019.jpg",
  "Marseille I": "marseille-tournament-page-image-2022.jpg",
  Miami: "miami_tournimage_2019_v2.jpg",
  "Monte-Carlo": "montecarlo_tournimage_16.jpg",
  Montpellier: "montpellier_tournimage_2019_v2.jpg",
  Montreal: "montreal-stadium-shot-2023.jpg",
  Munich: "munich-tournament-page-photo-2025.jpg",
  Paris: "paris_tournimage_2019_v3.jpg",
  Queens: "queens-club-2025-stadium.jpg",
  // Rio Open es el nombre real del ATP 500 de Rio de Janeiro.
  "Rio de Janeiro": "rio-open-2026-featured.jpg",
  "Roland Garros": "roland-garros-tournament-profile.jpg",
  "Roland Garros [TE4]": "roland-garros-tournament-profile.jpg",
  Rome: "rome-tournament-profile.jpg",
  Rotterdam: "rotterdam_tournimage_2022.jpg",
  Santiago: "santiago-tournament-page-photo-2023.jpg",
  Shanghai: "shanghai_tournimage_2022.jpg",
  Stockholm: "stockholm_tournimage_2025.jpg",
  Stuttgart: "stuttgart-tournament-image-2026.jpg",
  Sydney: "sydney-2025-stadium-shot.jpg",
  Tokyo: "tokyo_tournimage_2023.jpg",
  Umag: "umag-profile-page-2023.jpg",
  "US Open": "us-open-tournament-page-2021.jpg",
  Vienna: "vienna_tournimage_2025.jpg",
  Washington: "washington_tournimage_2024.jpg",
  Wimbledon: "wimbledon_tournimage.jpg",
  "Winston Salem": "winston-salem-open-stadium-2024.jpg",
  "Tour Finals": "tour-finals.jpg",
  "Next Gen Finals": "next-gen.jpg",
};

export function getTournamentHeaderUrl(eventName: string): string | null {
  const file = TOURNAMENT_HEADER_FILE[eventName];
  if (!file) return null;
  return `/assets/headers/${encodeURIComponent(file)}`;
}
