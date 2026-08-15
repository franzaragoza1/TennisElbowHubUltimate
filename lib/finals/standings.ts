import type { FinalsMatchResult } from "./types";

export interface FinalsParticipantInfo {
  playerId: number;
  seed: number;
}

export interface GroupStanding {
  playerId: number;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
}

/**
 * Tabla de un grupo a partir de los partidos ya jugados. No incluye el desempate: eso
 * lo hace `sortStandings` aparte, para poder mostrar la tabla sin ordenar (por seed)
 * durante la fase de asignación de grupos, antes de que se juegue nada.
 */
export function computeGroupStandings(
  participants: FinalsParticipantInfo[],
  matches: FinalsMatchResult[],
): GroupStanding[] {
  const table = new Map<number, GroupStanding>(
    participants.map((p) => [
      p.playerId,
      { playerId: p.playerId, seed: p.seed, played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 },
    ]),
  );

  for (const m of matches) {
    const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
    const winner = table.get(m.winnerId);
    const loser = table.get(loserId);
    if (!winner || !loser) continue; // partido de otro grupo/edición — no debería llegar aquí, pero no rompe la tabla

    winner.played++;
    loser.played++;
    winner.wins++;
    loser.losses++;

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

  return [...table.values()];
}

function setPct(s: GroupStanding): number {
  const total = s.setsWon + s.setsLost;
  return total === 0 ? 0 : s.setsWon / total;
}

function gamePct(s: GroupStanding): number {
  const total = s.gamesWon + s.gamesLost;
  return total === 0 ? 0 : s.gamesWon / total;
}

function headToHeadWinner(a: number, b: number, matches: FinalsMatchResult[]): number | null {
  const m = matches.find((x) => (x.player1Id === a && x.player2Id === b) || (x.player1Id === b && x.player2Id === a));
  return m?.winnerId ?? null;
}

/** Ordena descendente por `key` y agrupa en bloques de valor empatado, preservando el
 * orden entre bloques (mayor a menor). Lo reutilizan tanto el nivel superior
 * (victorias, partidos jugados) como cada paso de desempate por porcentaje. */
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

function resolvePair(pair: GroupStanding[], matches: FinalsMatchResult[]): GroupStanding[] {
  const [a, b] = pair;
  const winner = headToHeadWinner(a.playerId, b.playerId, matches);
  if (winner === a.playerId) return [a, b];
  if (winner === b.playerId) return [b, a];
  return [...pair].sort((x, y) => x.seed - y.seed); // no se han cruzado (no debería pasar en un round robin completo)
}

/**
 * Desempate oficial de la ATP Finals para un bloque ya empatado en victorias y
 * partidos jugados:
 *   - 2 jugadores: H2H directo.
 *   - 3+ jugadores: % de sets ganados: si separa a todos, listo; si dos quedan
 *     igualados, su H2H directo decide esos dos; si TODOS siguen empatados, se pasa
 *     a % de juegos ganados con la misma lógica; si también empatan en juegos, el
 *     seed del torneo decide.
 */
function resolveTieBlock(block: GroupStanding[], matches: FinalsMatchResult[]): GroupStanding[] {
  if (block.length <= 1) return block;
  if (block.length === 2) return resolvePair(block, matches);
  return resolveByPercentage(block, setPct, matches, "games");
}

function resolveByPercentage(
  block: GroupStanding[],
  metric: (s: GroupStanding) => number,
  matches: FinalsMatchResult[],
  nextStep: "games" | "seed",
): GroupStanding[] {
  const groups = groupByDescending(block, metric);

  if (groups.length === block.length) return groups.flat(); // separación total, ya está ordenado

  if (groups.length === 1) {
    // completamente empatados en esta métrica: bajar al siguiente escalón
    if (nextStep === "games") return resolveByPercentage(block, gamePct, matches, "seed");
    return [...block].sort((a, b) => a.seed - b.seed);
  }

  // separación parcial: cada sub-bloque (tamaño 1 o 2+) se resuelve por su cuenta,
  // reentrando en el mismo desempate — un sub-bloque de 2 cae directo en H2H.
  return groups.flatMap((g) => resolveTieBlock(g, matches));
}

/**
 * Orden oficial de la ATP Finals: Victorias > Partidos jugados > (2 empatados: H2H
 * directo | 3+ empatados: % sets, luego % juegos, con reversión a H2H en cuanto el
 * empate se reduce a 2, y seed del torneo si ni sets ni juegos separan a nadie).
 */
export function sortStandings(standings: GroupStanding[], matches: FinalsMatchResult[]): GroupStanding[] {
  return groupByDescending(standings, (s) => s.wins).flatMap((winsBlock) =>
    groupByDescending(winsBlock, (s) => s.played).flatMap((playedBlock) => resolveTieBlock(playedBlock, matches)),
  );
}
