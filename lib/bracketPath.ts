/**
 * Recorrido de un jugador por el cuadro — pura, sin React, para la vista compacta
 * (components/tournament/CompactBracket.tsx). Un jugador con id <= 0 (bye, TBD) nunca
 * tiene recorrido.
 */
export interface PathMatch {
  id: number;
  player1Id: number;
  player2Id: number;
}

export function matchIdsInvolving(
  matches: PathMatch[],
  playerId: number | null,
): Set<number> {
  const ids = new Set<number>();
  if (playerId === null || playerId <= 0) return ids;
  for (const m of matches) {
    if (m.player1Id === playerId || m.player2Id === playerId) ids.add(m.id);
  }
  return ids;
}

/** Una línea del cuadro forma parte del recorrido solo si los DOS partidos que une
 * (alimentador y destino) lo incluyen — el jugador ganó el primero y juega el segundo. */
export function isPathConnector(
  c: { fromMatchId?: number; toMatchId?: number },
  involved: Set<number>,
): boolean {
  return (
    c.fromMatchId !== undefined &&
    c.toMatchId !== undefined &&
    involved.has(c.fromMatchId) &&
    involved.has(c.toMatchId)
  );
}

// Rivales probables — pedido del propietario, 2026-09-26: al seguir a un jugador,
// enseñar contra quién puede jugar en CADA ronda que le queda, contando solo a los
// que siguen vivos en el cuadro.

export interface PathPlayer {
  id: number;
  displayName: string;
  country: string | null;
  seed: number | null;
}

interface PathLayoutMatch {
  id: number;
  round: string;
  player1Id: number;
  player2Id: number;
  winnerId: number | null;
  player1: PathPlayer;
  player2: PathPlayer;
}

interface PathLayoutNode {
  match: PathLayoutMatch;
  player1FeederId: number | null;
  player2FeederId: number | null;
}

export interface PathLayout {
  roundOrder: string[];
  matchesByRound: Map<string, PathLayoutNode[]>;
  positionById: Map<number, PathLayoutNode>;
}

export interface OpponentRound {
  round: string;
  matchId: number;
  /** Un solo jugador = rival ya decidido; varios = los que siguen vivos en esa mitad. */
  opponents: PathPlayer[];
}

export type PathSummary =
  | { status: "champion" }
  | { status: "eliminated"; round: string; by: PathPlayer | null }
  | { status: "alive"; rounds: OpponentRound[] };

/** Quién puede salir de este cruce: el ganador si ya está decidido; si no, cualquiera
 * de los dos lados — el jugador ya conocido, o (si ese lado sigue sin nombre) lo que
 * pueda salir del cruce anterior que lo alimenta. Byes y "TBD" (id <= 0) nunca cuentan. */
function aliveIn(layout: PathLayout, matchId: number): PathPlayer[] {
  const node = layout.positionById.get(matchId);
  if (!node) return [];
  const { match } = node;
  if (match.winnerId !== null && match.winnerId > 0) {
    const winner = match.winnerId === match.player1Id ? match.player1 : match.player2;
    return winner.id === match.winnerId ? [winner] : [];
  }
  const out: PathPlayer[] = [];
  for (const [player, feederId] of [
    [match.player1, node.player1FeederId],
    [match.player2, node.player2FeederId],
  ] as const) {
    if (player.id > 0) out.push(player);
    else if (feederId !== null) out.push(...aliveIn(layout, feederId));
  }
  return out;
}

export function summarizePath(layout: PathLayout, playerId: number | null): PathSummary | null {
  if (playerId === null || playerId <= 0) return null;

  let latest: PathLayoutNode | null = null;
  for (let i = layout.roundOrder.length - 1; i >= 0 && !latest; i--) {
    const list = layout.matchesByRound.get(layout.roundOrder[i]) ?? [];
    latest = list.find((n) => n.match.player1Id === playerId || n.match.player2Id === playerId) ?? null;
  }
  if (!latest) return null;

  const { match } = latest;
  const isLastRound = match.round === layout.roundOrder[layout.roundOrder.length - 1];
  if (match.winnerId !== null && match.winnerId !== playerId) {
    const by = match.winnerId === match.player1Id ? match.player1 : match.player2;
    return { status: "eliminated", round: match.round, by: by.id > 0 ? by : null };
  }
  if (match.winnerId === playerId && isLastRound) return { status: "champion" };

  const nextOf = new Map<number, PathLayoutNode>();
  for (const node of layout.positionById.values()) {
    for (const feeder of [node.player1FeederId, node.player2FeederId]) {
      if (feeder !== null) nextOf.set(feeder, node);
    }
  }

  const rounds: OpponentRound[] = [];
  if (match.winnerId === null) {
    const playerIsFirst = match.player1Id === playerId;
    const other = playerIsFirst ? match.player2 : match.player1;
    const otherFeeder = playerIsFirst ? latest.player2FeederId : latest.player1FeederId;
    const opponents = other.id > 0 ? [other] : otherFeeder !== null ? aliveIn(layout, otherFeeder) : [];
    rounds.push({ round: match.round, matchId: match.id, opponents });
  }

  let current: PathLayoutNode = latest;
  for (;;) {
    const next = nextOf.get(current.match.id);
    if (!next) break;
    const opponentFeeder = next.player1FeederId === current.match.id ? next.player2FeederId : next.player1FeederId;
    rounds.push({ round: next.match.round, matchId: next.match.id, opponents: opponentFeeder !== null ? aliveIn(layout, opponentFeeder) : [] });
    current = next;
  }

  return { status: "alive", rounds };
}
