import { pairKey } from "@/components/tournament/PredictionBracket";
import { BYE_PLAYER_ID, TBD_PLAYER_ID, type MatchCardPlayer } from "@/components/tournament/MatchCard";
import type { TournamentBracketMatch } from "@/components/tournament/BracketColumns";

/**
 * Cuadro ficticio para probar la UI de las predicciones sin tocar la base de datos —
 * pedido explícito del propietario (2026-09-18): "add a toggle to see dummy stats and
 * ui ... for testing bracket predictions". Un draw de 8 (Q/S/F) con un ejemplo de CADA
 * estado real que un hueco de R1 puede tener hoy: ya decidido de verdad, bye, en vivo,
 * y todavía abierto — más las rondas siguientes sin resolver (TBD), para comprobar de
 * un vistazo que el cuadro entero se pinta bien sin tener que esperar a que un torneo
 * real llegue a ese punto. Solo se usa detrás de `canUseDevPreview()` (ver
 * `lib/predictions/devPreview.ts`), nunca en producción.
 */
// Ids POSITIVOS a propósito (aunque ficticios) — `PredictionMatchCard`/`resolved` tratan
// cualquier id `> 0` como jugador real; solo `BYE_PLAYER_ID`/`TBD_PLAYER_ID` (-1/-2) son
// centinelas especiales. Un id negativo aquí se habría tratado como "sin jugador".
const player = (id: number, displayName: string, country: string | null): MatchCardPlayer => ({ id, displayName, country, seed: null });

const DUMMY_A = player(900001, "Dummy Winner", "ES");
const DUMMY_B = player(900002, "Dummy Loser", "FR");
const DUMMY_C = player(900003, "Dummy Bye Recipient", "IT");
const DUMMY_D = player(900004, "Dummy Live A", "DE");
const DUMMY_E = player(900005, "Dummy Live B", "PT");
const DUMMY_F = player(900006, "Dummy Open A", "AR");
const DUMMY_G = player(900007, "Dummy Open B", "BR");
const TBD = player(TBD_PLAYER_ID, "TBD", null);
const BYE = player(BYE_PLAYER_ID, "Bye", null);

export const DUMMY_BRACKET_DRAW_SIZE = 8;

export const DUMMY_BRACKET_MATCHES: TournamentBracketMatch[] = [
  // Q slot 0 — ya decidido de verdad (partido real jugado).
  { id: -9001, round: "Q", player1Id: DUMMY_A.id, player2Id: DUMMY_B.id, winnerId: DUMMY_A.id, sortIndex: 0, outcome: "played", player1: DUMMY_A, player2: DUMMY_B, sets: [{ setNumber: 1, winnerGames: 6, loserGames: 3, tiebreakLoserPoints: null }], youtubeVideoId: null },
  // Q slot 1 — bye.
  { id: -9002, round: "Q", player1Id: DUMMY_C.id, player2Id: BYE_PLAYER_ID, winnerId: DUMMY_C.id, sortIndex: 1, outcome: "bye", player1: DUMMY_C, player2: BYE, sets: [], youtubeVideoId: null },
  // Q slot 2 — en vivo ahora mismo (ver DUMMY_LIVE_KEYS).
  { id: -9003, round: "Q", player1Id: DUMMY_D.id, player2Id: DUMMY_E.id, winnerId: null, sortIndex: 2, outcome: "pending", player1: DUMMY_D, player2: DUMMY_E, sets: [], youtubeVideoId: null },
  // Q slot 3 — todavía abierto, ni jugado ni en vivo.
  { id: -9004, round: "Q", player1Id: DUMMY_F.id, player2Id: DUMMY_G.id, winnerId: null, sortIndex: 3, outcome: "pending", player1: DUMMY_F, player2: DUMMY_G, sets: [], youtubeVideoId: null },
  // S — ninguno de los dos huecos resuelto todavía.
  { id: -9005, round: "S", player1Id: TBD_PLAYER_ID, player2Id: TBD_PLAYER_ID, winnerId: null, sortIndex: 0, outcome: "pending", player1: TBD, player2: TBD, sets: [], youtubeVideoId: null },
  { id: -9006, round: "S", player1Id: TBD_PLAYER_ID, player2Id: TBD_PLAYER_ID, winnerId: null, sortIndex: 1, outcome: "pending", player1: TBD, player2: TBD, sets: [], youtubeVideoId: null },
  // F.
  { id: -9007, round: "F", player1Id: TBD_PLAYER_ID, player2Id: TBD_PLAYER_ID, winnerId: null, sortIndex: 0, outcome: "pending", player1: TBD, player2: TBD, sets: [], youtubeVideoId: null },
];

export const DUMMY_LIVE_KEYS = new Set([pairKey(DUMMY_D.id, DUMMY_E.id)]);
