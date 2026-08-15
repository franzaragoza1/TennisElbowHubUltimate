import type { FinalsFormat } from "./format";
import type { FinalsMatchResult } from "./types";
import type { FinalsParticipantInfo } from "./standings";

export type QualStatus = "qualified" | "eliminated" | "pending";

export interface QualificationInput {
  participants: FinalsParticipantInfo[]; // trae el seed, hace falta para el desempate oficial (paso 4d)
  playedMatches: FinalsMatchResult[];
  remainingPairs: [number, number][]; // cruces del grupo aún sin jugar
  format: FinalsFormat;
}

interface ScenarioSetOutcome {
  player1Id: number;
  player2Id: number;
  winnerId: number;
  winnerSets: number;
  loserSets: number;
}

/**
 * Todas las formas en que un cruce pendiente puede terminar, no solo quién gana:
 * también cuántos sets se lleva el perdedor (2-0 o 2-1 al mejor de 3; 3-0, 3-1 o 3-2
 * al mejor de 5). Es lo que permite que la clasificación sea "score-bound" y no solo
 * "win/loss-bound": el primer criterio de desempate a 3 bandas es el % de sets, así
 * que hace falta modelar el marcador en sets para que Q/E sea preciso de verdad, no
 * solo una aproximación por victorias.
 *
 * Lo que NO se modela son los juegos dentro de cada set hipotético — inventar un
 * marcador de juegos para un partido que no se ha jugado sería fabricar datos. Por
 * eso el % de juegos (paso 4b) solo se usa en un escenario cuando ya es un dato real
 * (ver `gamesKnown` más abajo); si hiciera falta y no se puede saber, esa rama se
 * deja en `pending` en vez de arriesgar un Q/E equivocado.
 */
function enumerateSetOutcomes(player1Id: number, player2Id: number, format: FinalsFormat): ScenarioSetOutcome[] {
  const outcomes: ScenarioSetOutcome[] = [];
  for (const winnerId of [player1Id, player2Id]) {
    for (let loserSets = 0; loserSets < format.setsToWin; loserSets++) {
      outcomes.push({ player1Id, player2Id, winnerId, winnerSets: format.setsToWin, loserSets });
    }
  }
  return outcomes;
}

function enumerateScenarios(pairs: [number, number][], format: FinalsFormat): ScenarioSetOutcome[][] {
  if (pairs.length === 0) return [[]];
  const [[player1Id, player2Id], ...rest] = pairs;
  const thisMatch = enumerateSetOutcomes(player1Id, player2Id, format);
  const restScenarios = enumerateScenarios(rest, format);
  const scenarios: ScenarioSetOutcome[][] = [];
  for (const outcome of thisMatch) for (const rs of restScenarios) scenarios.push([outcome, ...rs]);
  return scenarios;
}

interface ScenarioPlayerStats {
  wins: number;
  played: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  /** false si al jugador le queda algún partido de este grupo por disputar: su total
   * real de juegos todavía puede cambiar, así que no es un dato fiable para desempatar. */
  gamesKnown: boolean;
}

function baseStats(participantIds: number[], playedMatches: FinalsMatchResult[]): Map<number, ScenarioPlayerStats> {
  const stats = new Map<number, ScenarioPlayerStats>(
    participantIds.map((id) => [id, { wins: 0, played: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gamesKnown: true }]),
  );
  for (const m of playedMatches) {
    const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
    const winner = stats.get(m.winnerId);
    const loser = stats.get(loserId);
    if (!winner || !loser) continue;
    winner.wins++;
    winner.played++;
    loser.played++;
    for (const s of m.sets) {
      const winnerWonSet = s.winnerGames > s.loserGames;
      winner.setsWon += winnerWonSet ? 1 : 0;
      winner.setsLost += winnerWonSet ? 0 : 1;
      loser.setsWon += winnerWonSet ? 0 : 1;
      loser.setsLost += winnerWonSet ? 1 : 0;
      winner.gamesWon += s.winnerGames;
      winner.gamesLost += s.loserGames;
      loser.gamesWon += s.loserGames;
      loser.gamesLost += s.winnerGames;
    }
  }
  return stats;
}

function groupByDescending<T>(items: T[], key: (t: T) => number): T[][] {
  const sorted = [...items].sort((a, b) => key(b) - key(a));
  const groups: T[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && key(last[0]) === key(item)) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

/**
 * Igual que `sortStandings` (mismo orden oficial: victorias, partidos jugados, H2H o
 * % sets/juegos, seed), pero para UN escenario concreto y devolviendo un RANGO de
 * posición por jugador en vez de una posición fija. El rango solo se abre cuando el
 * paso de % de juegos haría falta y no se puede calcular sin inventar un marcador
 * (`gamesKnown === false`) — en cualquier otro caso, incluido el desempate por seed,
 * el escenario resuelve una posición exacta, porque el seed siempre decide.
 */
function resolveScenarioRanks(
  participantIds: number[],
  stats: Map<number, ScenarioPlayerStats>,
  matches: { player1Id: number; player2Id: number; winnerId: number }[],
  seeds: Map<number, number>,
): Map<number, { best: number; worst: number }> {
  const ranges = new Map<number, { best: number; worst: number }>();

  function headToHead(a: number, b: number): number | null {
    const m = matches.find((x) => (x.player1Id === a && x.player2Id === b) || (x.player1Id === b && x.player2Id === a));
    return m?.winnerId ?? null;
  }
  const setPct = (id: number) => {
    const s = stats.get(id)!;
    const t = s.setsWon + s.setsLost;
    return t === 0 ? 0 : s.setsWon / t;
  };
  const gamePct = (id: number) => {
    const s = stats.get(id)!;
    const t = s.gamesWon + s.gamesLost;
    return t === 0 ? 0 : s.gamesWon / t;
  };

  function assignExact(ids: number[], top: number) {
    ids.forEach((id, i) => ranges.set(id, { best: top + i, worst: top + i }));
  }
  function assignRange(ids: number[], top: number, bottom: number) {
    for (const id of ids) ranges.set(id, { best: top, worst: bottom });
  }

  function resolveBlock(ids: number[], top: number, level: "sets" | "games" | "seed") {
    const bottom = top + ids.length - 1;
    if (ids.length === 1) {
      assignExact(ids, top);
      return;
    }
    if (ids.length === 2) {
      const winner = headToHead(ids[0], ids[1]);
      if (winner === ids[0]) assignExact(ids, top);
      else if (winner === ids[1]) assignExact([ids[1], ids[0]], top);
      else assignRange(ids, top, bottom); // no se han cruzado (no debería pasar en un round robin completo)
      return;
    }

    if (level === "seed") {
      assignExact([...ids].sort((a, b) => seeds.get(a)! - seeds.get(b)!), top);
      return;
    }

    if (level === "games" && !ids.every((id) => stats.get(id)!.gamesKnown)) {
      // hace falta el % de juegos para separar, pero al menos uno de ellos todavía
      // tiene un partido pendiente: no se inventa el marcador, se deja en rango.
      assignRange(ids, top, bottom);
      return;
    }

    const metric = level === "sets" ? setPct : gamePct;
    const groups = groupByDescending(ids, metric);

    if (groups.length === ids.length) {
      let cursor = top;
      for (const g of groups) {
        assignExact(g, cursor);
        cursor++;
      }
      return;
    }
    if (groups.length === 1) {
      resolveBlock(ids, top, level === "sets" ? "games" : "seed");
      return;
    }
    let cursor = top;
    for (const g of groups) {
      resolveBlock(g, cursor, level);
      cursor += g.length;
    }
  }

  let cursor = 1;
  for (const winsBlock of groupByDescending(participantIds, (id) => stats.get(id)!.wins)) {
    for (const playedBlock of groupByDescending(winsBlock, (id) => stats.get(id)!.played)) {
      resolveBlock(playedBlock, cursor, "sets");
      cursor += playedBlock.length;
    }
  }

  return ranges;
}

/**
 * Q/E "score-bound": recorre todos los escenarios posibles para los cruces que
 * quedan, modelando no solo quién gana cada uno sino también el marcador en sets
 * (según el formato del torneo), y aplica el desempate oficial completo a cada
 * escenario. Un jugador es:
 *   - Qualified: en el peor de los escenarios, sigue quedando 2º o mejor.
 *   - Eliminated: en el mejor de los escenarios, no pasa de 3º.
 *   - si no, Pending — incluye los pocos casos en los que ni siquiera el peor/mejor
 *     caso se puede fijar porque haría falta un marcador de juegos que todavía no
 *     existe.
 */
export function computeQualificationStatus({
  participants,
  playedMatches,
  remainingPairs,
  format,
}: QualificationInput): Record<number, QualStatus> {
  const participantIds = participants.map((p) => p.playerId);
  const seeds = new Map(participants.map((p) => [p.playerId, p.seed]));
  const playersWithRemaining = new Set(remainingPairs.flatMap(([a, b]) => [a, b]));
  const base = baseStats(participantIds, playedMatches);

  const worstAcrossScenarios = new Map(participantIds.map((id) => [id, 0]));
  const bestAcrossScenarios = new Map(participantIds.map((id) => [id, Number.POSITIVE_INFINITY]));

  for (const scenario of enumerateScenarios(remainingPairs, format)) {
    const stats = new Map<number, ScenarioPlayerStats>(
      participantIds.map((id) => {
        const b = base.get(id)!;
        return [id, { ...b, gamesKnown: !playersWithRemaining.has(id) }];
      }),
    );
    for (const outcome of scenario) {
      const loserId = outcome.winnerId === outcome.player1Id ? outcome.player2Id : outcome.player1Id;
      const winner = stats.get(outcome.winnerId)!;
      const loser = stats.get(loserId)!;
      winner.wins++;
      winner.played++;
      loser.played++;
      winner.setsWon += outcome.winnerSets;
      winner.setsLost += outcome.loserSets;
      loser.setsWon += outcome.loserSets;
      loser.setsLost += outcome.winnerSets;
    }

    const scenarioMatches = [
      ...playedMatches.map((m) => ({ player1Id: m.player1Id, player2Id: m.player2Id, winnerId: m.winnerId })),
      ...scenario.map((o) => ({ player1Id: o.player1Id, player2Id: o.player2Id, winnerId: o.winnerId })),
    ];
    const ranges = resolveScenarioRanks(participantIds, stats, scenarioMatches, seeds);
    for (const id of participantIds) {
      const { best, worst } = ranges.get(id)!;
      worstAcrossScenarios.set(id, Math.max(worstAcrossScenarios.get(id)!, worst));
      bestAcrossScenarios.set(id, Math.min(bestAcrossScenarios.get(id)!, best));
    }
  }

  const result: Record<number, QualStatus> = {};
  for (const id of participantIds) {
    if (worstAcrossScenarios.get(id)! <= 2) result[id] = "qualified";
    else if (bestAcrossScenarios.get(id)! >= 3) result[id] = "eliminated";
    else result[id] = "pending";
  }
  return result;
}
