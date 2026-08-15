import { describe, expect, it } from "vitest";
import { computeGroupStandings, sortStandings, type GroupStanding } from "./standings";
import type { FinalsMatchResult } from "./types";

const PARTICIPANTS = [
  { playerId: 1, seed: 1 },
  { playerId: 2, seed: 2 },
  { playerId: 3, seed: 3 },
  { playerId: 4, seed: 4 },
];

/** Round robin completo de un grupo de 4: P1 gana todo, P4 pierde todo. */
const GROUP_MATCHES: FinalsMatchResult[] = [
  { id: 1, player1Id: 1, player2Id: 2, winnerId: 1, sets: [{ winnerGames: 6, loserGames: 3 }, { winnerGames: 6, loserGames: 4 }] },
  { id: 2, player1Id: 1, player2Id: 3, winnerId: 1, sets: [{ winnerGames: 6, loserGames: 2 }, { winnerGames: 6, loserGames: 1 }] },
  { id: 3, player1Id: 1, player2Id: 4, winnerId: 1, sets: [{ winnerGames: 6, loserGames: 0 }, { winnerGames: 6, loserGames: 0 }] },
  { id: 4, player1Id: 2, player2Id: 3, winnerId: 2, sets: [{ winnerGames: 6, loserGames: 4 }, { winnerGames: 6, loserGames: 4 }] },
  { id: 5, player1Id: 2, player2Id: 4, winnerId: 2, sets: [{ winnerGames: 6, loserGames: 1 }, { winnerGames: 6, loserGames: 2 }] },
  { id: 6, player1Id: 3, player2Id: 4, winnerId: 3, sets: [{ winnerGames: 6, loserGames: 4 }, { winnerGames: 6, loserGames: 3 }] },
];

describe("computeGroupStandings", () => {
  it("agrega victorias, sets y juegos de cada jugador a partir del round robin", () => {
    const table = computeGroupStandings(PARTICIPANTS, GROUP_MATCHES);
    const p1 = table.find((s) => s.playerId === 1)!;
    const p4 = table.find((s) => s.playerId === 4)!;

    expect(p1).toMatchObject({ played: 3, wins: 3, losses: 0, setsWon: 6, setsLost: 0, gamesWon: 36, gamesLost: 10 });
    expect(p4).toMatchObject({ played: 3, wins: 0, losses: 3, setsWon: 0, setsLost: 6, gamesWon: 10, gamesLost: 36 });
  });

  it("no revienta si un partido referencia a un jugador fuera de la lista de participantes", () => {
    const foreign: FinalsMatchResult = { id: 99, player1Id: 1, player2Id: 999, winnerId: 1, sets: [] };
    expect(() => computeGroupStandings(PARTICIPANTS, [...GROUP_MATCHES, foreign])).not.toThrow();
  });

  it("el orden final del grupo, ya resuelto, es P1 > P2 > P3 > P4", () => {
    const table = sortStandings(computeGroupStandings(PARTICIPANTS, GROUP_MATCHES), GROUP_MATCHES);
    expect(table.map((s) => s.playerId)).toEqual([1, 2, 3, 4]);
  });
});

function standing(overrides: Partial<GroupStanding> & Pick<GroupStanding, "playerId" | "seed">): GroupStanding {
  return { played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, ...overrides };
}

function h2h(id: number, player1Id: number, player2Id: number, winnerId: number): FinalsMatchResult {
  return { id, player1Id, player2Id, winnerId, sets: [] };
}

describe("sortStandings — desempate oficial ATP Finals", () => {
  it("paso 1: más victorias manda primero", () => {
    const table = [standing({ playerId: 1, seed: 2, wins: 1 }), standing({ playerId: 2, seed: 1, wins: 2 })];
    expect(sortStandings(table, []).map((s) => s.playerId)).toEqual([2, 1]);
  });

  it("paso 2: con las mismas victorias, más partidos jugados manda (2-1 le gana a 2-0)", () => {
    const table = [
      standing({ playerId: 1, seed: 1, wins: 2, played: 2 }),
      standing({ playerId: 2, seed: 2, wins: 2, played: 3 }),
    ];
    expect(sortStandings(table, []).map((s) => s.playerId)).toEqual([2, 1]);
  });

  it("paso 3: empate a 2, decide el H2H directo aunque el resto de stats diga lo contrario", () => {
    const table = [
      standing({ playerId: 1, seed: 1, wins: 2, played: 3, setsWon: 6, setsLost: 1, gamesWon: 60, gamesLost: 10 }),
      standing({ playerId: 2, seed: 2, wins: 2, played: 3, setsWon: 2, setsLost: 3, gamesWon: 20, gamesLost: 25 }),
    ];
    const matches = [h2h(1, 2, 1, 2)]; // P2 le ganó a P1 en su cruce directo
    expect(sortStandings(table, matches).map((s) => s.playerId)).toEqual([2, 1]);
  });

  it("paso 4a: empate a tres, separa el % de sets ganados", () => {
    const table = [
      standing({ playerId: 1, seed: 1, wins: 1, played: 3, setsWon: 3, setsLost: 4 }), // 3/7 ≈ 42.9%
      standing({ playerId: 2, seed: 2, wins: 1, played: 3, setsWon: 2, setsLost: 4 }), // 2/6 ≈ 33.3%
      standing({ playerId: 3, seed: 3, wins: 1, played: 3, setsWon: 2, setsLost: 5 }), // 2/7 ≈ 28.6%
    ];
    expect(sortStandings(table, []).map((s) => s.playerId)).toEqual([1, 2, 3]);
  });

  it("paso 4c: el % de sets deja a dos igualados y su H2H directo decide ese empate reducido", () => {
    const table = [
      standing({ playerId: 1, seed: 1, wins: 1, played: 3, setsWon: 3, setsLost: 4 }), // 3/7
      standing({ playerId: 2, seed: 2, wins: 1, played: 3, setsWon: 3, setsLost: 4 }), // 3/7, empatado con P1
      standing({ playerId: 3, seed: 3, wins: 1, played: 3, setsWon: 2, setsLost: 6 }), // 2/8, claramente por detrás
    ];
    const matches = [h2h(1, 1, 2, 2)]; // P2 le ganó a P1 en su cruce directo
    expect(sortStandings(table, matches).map((s) => s.playerId)).toEqual([2, 1, 3]);
  });

  it("paso 4b: igualados en % de sets, decide el % de juegos ganados", () => {
    const table = [
      standing({ playerId: 1, seed: 1, wins: 1, played: 3, setsWon: 2, setsLost: 4, gamesWon: 30, gamesLost: 20 }), // sets 2/6, juegos 60%
      standing({ playerId: 2, seed: 2, wins: 1, played: 3, setsWon: 2, setsLost: 4, gamesWon: 25, gamesLost: 25 }), // sets 2/6, juegos 50%
      standing({ playerId: 3, seed: 3, wins: 1, played: 3, setsWon: 2, setsLost: 4, gamesWon: 20, gamesLost: 30 }), // sets 2/6, juegos 40%
    ];
    expect(sortStandings(table, []).map((s) => s.playerId)).toEqual([1, 2, 3]);
  });

  it("paso 4d: empate total en sets y juegos, decide el seed del torneo", () => {
    const table = [
      standing({ playerId: 1, seed: 3, wins: 1, played: 3, setsWon: 2, setsLost: 4, gamesWon: 24, gamesLost: 26 }),
      standing({ playerId: 2, seed: 1, wins: 1, played: 3, setsWon: 2, setsLost: 4, gamesWon: 24, gamesLost: 26 }),
      standing({ playerId: 3, seed: 2, wins: 1, played: 3, setsWon: 2, setsLost: 4, gamesWon: 24, gamesLost: 26 }),
    ];
    expect(sortStandings(table, []).map((s) => s.playerId)).toEqual([2, 3, 1]);
  });
});
