import { TournamentCard, type TournamentCardData } from "@/components/tournaments/TournamentCard";

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
}

const STATUS_LABEL: Record<FinalsEditionCardData["status"], string> = {
  setup: "Setting up",
  groups: "Group stage",
  knockout: "Knockout stage",
  completed: "Completed",
};

/**
 * Misma conversión la usan `FinalsEditionCard` (aquí abajo, para `/finals`) y
 * `app/tournaments/page.tsx` (sección "Season Finale") — un solo sitio donde tocarla.
 * No tiene `surface` real en su esquema (`finalsEditions` no la modela, es un evento
 * de fin de temporada, no un torneo del archivo de Mana Games), así que
 * `TournamentCard` recibe `surface: null` y se las apaña sin ella en vez de inventar
 * una.
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
    editionId: data.id,
    externalId: null, // no viene de OT_ViewTournament.php, no hay Trn= que enlazar
    eventName,
    year: data.year,
    isoWeek: null,
    surface: null,
    category: `${eventName} · ${STATUS_LABEL[data.status]}`,
    championId: data.championId,
    championName: data.championName,
    championCountry: data.championCountry,
    runnerUpName: data.runnerUpName,
    runnerUpCountry: data.runnerUpCountry,
    finalScore: data.finalScore,
    // El estado de Finals ya se enseña en la línea de categoría de arriba
    // ("Tour Finals · Group stage") — "completed" aquí solo evita que la tarjeta
    // pinte la insignia nueva de registration/ongoing encima de esa misma información.
    status: "completed",
  };
}

/**
 * Misma tarjeta que un torneo normal (mismo pop al pasar el ratón, mismo escudo que
 * crece, mismo expandible de finalista/marcador) — pedido explícito de que las Tour
 * Finals no se sientan como una sección aparte.
 */
export function FinalsEditionCard({ data }: { data: FinalsEditionCardData }) {
  return <TournamentCard data={finalsEditionToTournamentCard(data)} tier="large" href={`/finals/${data.id}`} />;
}
