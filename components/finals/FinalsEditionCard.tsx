import type { TournamentCardData } from "@/components/tournaments/TournamentCard";
import type { TournamentStatus } from "@/lib/tournamentStatus";

export interface FinalsEditionCardData {
  id: number;
  kind: "tour_finals" | "next_gen_finals";
  year: number;
  displayName: string;
  status: "setup" | "groups" | "knockout" | "completed";
  championId: number | null;
  championName: string | null;
  championCountry: string | null;
  runnerUpName: string | null;
  runnerUpCountry: string | null;
  finalScore: string | null;
  mirroredEditionId: number | null;
}

/** `finalsEditions.status` → el vocabulario de 3 estados que ya conoce `TournamentCard`
 * (derivado de partidos para un torneo normal, ver `lib/tournamentStatus.ts`). 'setup'
 * (semillas puestas, grupos sin cerrar todavía) no tiene nada público que enseñar
 * todavía — el más parecido de los tres es 'registration' (tarjeta no clicable, sin
 * insignia de "Ongoing"). 'groups'/'knockout' son la misma cosa de cara al público: un
 * torneo en juego. */
const STATUS: Record<FinalsEditionCardData["status"], TournamentStatus> = {
  setup: "registration",
  groups: "ongoing",
  knockout: "ongoing",
  completed: "completed",
};

/**
 * La usa `app/tournaments/page.tsx` (sección "Season Finale") para pintar la tarjeta de
 * Finals con el mismo `TournamentCard` que un torneo normal — pedido explícito
 * (2026-09-17): "Finals should look like the other tournaments". Antes esta función
 * forzaba `surface: null` y `status: "completed"` siempre, colando el estado real
 * dentro de `category` como texto libre ("Next Gen Finals · Group stage") para que la
 * insignia de estado no se superpusiera a esa misma información — el resultado eran
 * dos textos con el nombre del evento repetido y nunca una insignia "Ongoing" de
 * verdad, ni el filete/etiqueta de superficie que sí tiene cualquier otra tarjeta.
 *
 * Ni Tour Finals ni Next Gen Finals tienen superficie variable de verdad (siempre
 * indoor, siempre pista dura, en el mundo real y en TE4) — `"Indoor Concrete"` es un
 * valor real ya reconocido en todo el sitio (`lib/surfaceColors.ts`), así que se
 * traduce solo a "Indoor Hard" y colorea en azul "Hard" sin inventar una etiqueta
 * nueva. Ver también `lib/finals/mirror.ts::ensureMirroredEdition`, que pone esta
 * misma superficie en el espejo real para que la ficha propia del torneo coincida.
 */
export function finalsEditionToTournamentCard(data: FinalsEditionCardData): TournamentCardData {
  // "Tour Finals" / "Next Gen Finals" a secas, NO `data.displayName` (texto libre del
  // admin, típicamente "Tour Finals 2025" con el año ya dentro) — `eventName` aquí
  // hace doble función: título de la tarjeta Y clave de búsqueda del escudo en
  // lib/tournamentLogos.ts (`TOURNAMENT_LOGO_FOLDER["Tour Finals"]`), que es por
  // nombre de evento recurrente, no por edición concreta. Con el año dentro del
  // texto libre, la búsqueda nunca encontraba el escudo — y el año ya se enseña
  // aparte más abajo (`data.year`), como en cualquier otra tarjeta de torneo.
  const eventName = data.kind === "tour_finals" ? "Tour Finals" : "Next Gen Finals";
  return {
    // NUNCA se usa como href real (siempre se pasa `href` explícito al llamar a
    // `TournamentCard` — no hay /finals/[id] propio, retirado 2026-09-09, así que el
    // fallback por defecto de TournamentCard, `/tournaments/${editionId}`, sería
    // simplemente incorrecto aquí). Se rellena solo porque `TournamentCardData.editionId`
    // es obligatorio.
    editionId: data.id,
    externalId: null, // no viene de OT_ViewTournament.php, no hay Trn= que enlazar
    eventName,
    year: data.year,
    isoWeek: null,
    surface: "Indoor Concrete",
    // "Season Finale" en vez de repetir `eventName` — la tarjeta ya enseña "Tour
    // Finals"/"Next Gen Finals" como título grande; la línea de arriba es donde el
    // resto de tarjetas ponen su categoría/tier ("Masters 1000", "Grand Slam"...).
    category: "Season Finale",
    championId: data.championId,
    championName: data.championName,
    championCountry: data.championCountry,
    runnerUpName: data.runnerUpName,
    runnerUpCountry: data.runnerUpCountry,
    finalScore: data.finalScore,
    status: STATUS[data.status],
  };
}
