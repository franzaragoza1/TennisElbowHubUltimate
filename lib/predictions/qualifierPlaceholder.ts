/**
 * Un hueco de la primera ronda del Main Draw reservado a quien gane la
 * clasificación ("Qualifier #N" literal en el cuadro fuente, ver
 * lib/tournamentBracketData.ts::getBracketMatchesForEdition) necesita un id de
 * "jugador" para poder elegirse en Bracket Predictions — el resto del pipeline
 * (`lib/bracket.ts`, `lib/predictions/scoring.ts`, `marqueePicks.ts`,
 * `validatePicks.ts`, `components/tournament/PredictionBracket.tsx`) ya trata
 * cualquier id `> 0` como un candidato real y elegible, así que basta con un id
 * sintético POSITIVO (a diferencia de `BYE_PLAYER_ID`/`TBD_PLAYER_ID`, negativos a
 * propósito para que esos mismos `> 0` los descarten).
 *
 * El id es una función PURA de su posición de origen (`sortIndex` dentro de la
 * ronda + qué lado) — nunca un valor propio guardado en ningún sitio. Eso es lo que
 * permite resolver un pick antiguo más tarde sin necesitar recordar en ningún sitio
 * "este hueco fue una vez un Qualifier": basta con decodificar el id y volver a
 * mirar qué hay AHORA MISMO en esa misma posición (ver
 * `getQualifierSlotResolution` en lib/predictions/queries.ts, el único llamante que
 * de verdad necesita tocar la base de datos — este fichero se queda deliberadamente
 * puro y sin `@/db`, para poder testear el encode/decode/apply sin más).
 */
import type { BracketPick } from "./scoring";

// Muy por encima de cualquier `players.id` real (escala actual: unos pocos miles de
// jugadores desde 2021, ver CLAUDE.md §5) — no hay margen realista de colisión.
export const QUALIFIER_ID_BASE = 900_000_000;

export type QualifierSide = "player1" | "player2";

export function encodeQualifierPlaceholderId(sortIndex: number, side: QualifierSide): number {
  return QUALIFIER_ID_BASE + sortIndex * 2 + (side === "player2" ? 1 : 0);
}

export function decodeQualifierPlaceholderId(id: number): { sortIndex: number; side: QualifierSide } | null {
  if (id < QUALIFIER_ID_BASE) return null;
  const offset = id - QUALIFIER_ID_BASE;
  return { sortIndex: Math.floor(offset / 2), side: offset % 2 === 0 ? "player1" : "player2" };
}

export type QualifierSlotResolution = Map<number, { player1Id: number | null; player2Id: number | null }>;

/**
 * Sustituye cualquier pick que apunte a un hueco de clasificación por el jugador
 * REAL si ya se conoce (`resolution`, ver `getQualifierSlotResolution`). Si el
 * hueco real sigue sin nombre todavía, el pick se queda con el id sintético tal
 * cual — no puede coincidir con ningún `winnerId` real todavía, así que
 * sencillamente no puntúa hasta que se sepa (mismo comportamiento que cualquier
 * otro hueco sin decidir en `scorePrediction`).
 */
export function applyQualifierResolution(picks: BracketPick[], resolution: QualifierSlotResolution): BracketPick[] {
  if (resolution.size === 0) return picks;
  return picks.map((p) => {
    const decoded = decodeQualifierPlaceholderId(p.playerId);
    if (!decoded) return p;
    const current = resolution.get(decoded.sortIndex);
    const realId = current ? (decoded.side === "player1" ? current.player1Id : current.player2Id) : null;
    return realId !== null ? { ...p, playerId: realId } : p;
  });
}
