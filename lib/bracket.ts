/**
 * Reconstrucción del árbol del cuadro a partir de los partidos planos que ya tenemos
 * en `matches` — no hay ningún dato de posición almacenado, así que se deduce
 * emparejando el `winnerId` de una ronda con el `player1Id`/`player2Id` de la
 * siguiente (verificado a mano contra datos reales, ver plan de esta fase).
 */

const ROUND_PRIORITY = ["R1", "R2", "R3", "R4", "R5", "R6", "Q", "S", "F"];

export interface BracketMatchInput {
  id: number;
  round: string;
  player1Id: number;
  player2Id: number;
  winnerId: number;
}

export interface PositionedMatch<M extends BracketMatchInput = BracketMatchInput> {
  match: M;
  round: string;
  y: number;
  /** id del partido de la ronda anterior cuyo ganador es player1, o null si no hay (bye / primera ronda). */
  player1FeederId: number | null;
  player2FeederId: number | null;
}

export interface BracketLayout<M extends BracketMatchInput = BracketMatchInput> {
  roundOrder: string[];
  matchesByRound: Map<string, PositionedMatch<M>[]>;
  positionById: Map<number, PositionedMatch<M>>;
}

function determineRoundOrder(matches: BracketMatchInput[]): string[] {
  const present = new Set(matches.map((m) => m.round));
  return ROUND_PRIORITY.filter((r) => present.has(r));
}

export function buildBracketLayout<M extends BracketMatchInput>(matches: M[]): BracketLayout<M> {
  const roundOrder = determineRoundOrder(matches);
  const matchesByRoundRaw = new Map<string, M[]>();
  for (const round of roundOrder) {
    matchesByRoundRaw.set(
      round,
      matches.filter((m) => m.round === round),
    );
  }

  const positioned = new Map<number, PositionedMatch<M>>();
  let nextLeafY = 0;

  function resolvePlayer(playerId: number, roundIndex: number): { y: number; feederId: number | null } {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const feeder = (matchesByRoundRaw.get(roundOrder[i]) ?? []).find((m) => m.winnerId === playerId);
      if (feeder) {
        const pos = resolveMatch(feeder, i);
        return { y: pos.y, feederId: feeder.id };
      }
    }
    return { y: nextLeafY++, feederId: null };
  }

  function resolveMatch(match: M, roundIndex: number): PositionedMatch<M> {
    const existing = positioned.get(match.id);
    if (existing) return existing;

    // Se reserva antes de recursar: si los datos tuvieran un ciclo (no debería pasar
    // en un cuadro de eliminación directa válido), esto evita un bucle infinito.
    const placeholder: PositionedMatch<M> = {
      match,
      round: match.round,
      y: 0,
      player1FeederId: null,
      player2FeederId: null,
    };
    positioned.set(match.id, placeholder);

    const p1 = resolvePlayer(match.player1Id, roundIndex);
    const p2 = resolvePlayer(match.player2Id, roundIndex);
    placeholder.y = (p1.y + p2.y) / 2;
    placeholder.player1FeederId = p1.feederId;
    placeholder.player2FeederId = p2.feederId;
    return placeholder;
  }

  const lastRoundIndex = roundOrder.length - 1;
  for (const finalMatch of matchesByRoundRaw.get(roundOrder[lastRoundIndex]) ?? []) {
    resolveMatch(finalMatch, lastRoundIndex);
  }

  // Cualquier partido no alcanzado desde la Final es un dato anómalo (no debería
  // pasar) — se posiciona igualmente para no perderlo, y se avisa por consola.
  for (let i = 0; i < roundOrder.length; i++) {
    for (const m of matchesByRoundRaw.get(roundOrder[i]) ?? []) {
      if (!positioned.has(m.id)) {
        console.warn(`[bracket] partido ${m.id} (ronda ${m.round}) no alcanzado desde la Final`);
        resolveMatch(m, i);
      }
    }
  }

  const matchesByRound = new Map<string, PositionedMatch<M>[]>();
  for (const round of roundOrder) {
    const list = (matchesByRoundRaw.get(round) ?? []).map((m) => positioned.get(m.id)!);
    list.sort((a, b) => a.y - b.y);
    matchesByRound.set(round, list);
  }

  return { roundOrder, matchesByRound, positionById: positioned };
}

/**
 * Etiqueta de ronda "de toda la vida" (R32, R16, QF, SF, F) calculada por posición
 * desde la Final, no por el código interno — así se lee igual sin importar cuántas
 * rondas `R` tenga ese cuadro en concreto.
 */
export function roundDisplayLabel(roundOrder: string[], round: string): string {
  const idx = roundOrder.indexOf(round);
  if (idx === -1) return round;
  const fromEnd = roundOrder.length - 1 - idx;
  if (fromEnd === 0) return "F";
  if (fromEnd === 1) return "SF";
  if (fromEnd === 2) return "QF";
  return `R${2 ** (fromEnd + 1)}`;
}
