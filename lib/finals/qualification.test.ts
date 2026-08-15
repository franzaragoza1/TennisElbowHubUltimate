import { describe, expect, it } from "vitest";
import { computeQualificationStatus } from "./qualification";
import { FINALS_FORMAT } from "./format";
import type { FinalsMatchResult } from "./types";
import type { FinalsParticipantInfo } from "./standings";

const [P1, P2, P3, P4] = [1, 2, 3, 4];
const PARTICIPANTS: FinalsParticipantInfo[] = [
  { playerId: P1, seed: 1 },
  { playerId: P2, seed: 2 },
  { playerId: P3, seed: 3 },
  { playerId: P4, seed: 4 },
];

const played = (id: number, player1Id: number, player2Id: number, winnerId: number): FinalsMatchResult => ({
  id,
  player1Id,
  player2Id,
  winnerId,
  sets: [{ winnerGames: 6, loserGames: 3 }, { winnerGames: 6, loserGames: 4 }],
});

describe("computeQualificationStatus — casos decididos solo por victorias", () => {
  it("marca Eliminado a los dos últimos antes de jugarse el último partido del grupo", () => {
    const status = computeQualificationStatus({
      participants: PARTICIPANTS,
      playedMatches: [
        played(1, P1, P2, P1),
        played(2, P1, P3, P1),
        played(3, P1, P4, P1),
        played(4, P2, P3, P2),
        played(5, P2, P4, P2),
      ],
      remainingPairs: [[P3, P4]],
      format: FINALS_FORMAT.tour_finals,
    });

    expect(status[P1]).toBe("qualified");
    expect(status[P2]).toBe("qualified");
    expect(status[P3]).toBe("eliminated");
    expect(status[P4]).toBe("eliminated");
  });

  it("con dos cruces por jugar, deja pendientes a quienes de verdad dependen del resultado", () => {
    const status = computeQualificationStatus({
      participants: PARTICIPANTS,
      playedMatches: [played(1, P1, P2, P1), played(2, P1, P3, P1), played(3, P2, P4, P2), played(4, P3, P4, P3)],
      remainingPairs: [
        [P1, P4],
        [P2, P3],
      ],
      format: FINALS_FORMAT.tour_finals,
    });

    expect(status[P1]).toBe("qualified");
    expect(status[P2]).toBe("pending");
    expect(status[P3]).toBe("pending");
    expect(status[P4]).toBe("eliminated");
  });

  it("el resultado no cambia con el formato al mejor de 5 (Next Gen) cuando lo deciden solo las victorias", () => {
    const status = computeQualificationStatus({
      participants: PARTICIPANTS,
      playedMatches: [
        played(1, P1, P2, P1),
        played(2, P1, P3, P1),
        played(3, P1, P4, P1),
        played(4, P2, P3, P2),
        played(5, P2, P4, P2),
      ],
      remainingPairs: [[P3, P4]],
      format: FINALS_FORMAT.next_gen_finals,
    });

    expect(status[P1]).toBe("qualified");
    expect(status[P2]).toBe("qualified");
    expect(status[P3]).toBe("eliminated");
    expect(status[P4]).toBe("eliminated");
  });
});

describe("computeQualificationStatus — precisión 'score-bound'", () => {
  it("un empate a tres en victorias no bloquea el cálculo si el % de sets ya acumulado lo resuelve en todos los escenarios", () => {
    // P1 bate a P3 2-1 y pierde con P2 2-0 (ambos ya jugados y fijos). Solo queda
    // P2 vs P3. Si P2 pierde ese cruce, P1/P2/P3 acaban los tres empatados a 1
    // victoria — un desempate que solo mirando victorias (el método anterior, más
    // conservador) dejaría "pending" para los tres. Pero el % de sets que P2 y P3 ya
    // llevan acumulado es tan dispar que, se juegue como se juegue ese último
    // partido (2-0 o 2-1), P2 nunca puede acabar peor que 2º — así que sí se puede
    // marcar Qualified de verdad, sin inventar el marcador del partido pendiente.
    const participants: FinalsParticipantInfo[] = [
      { playerId: P1, seed: 1 },
      { playerId: P2, seed: 2 },
      { playerId: P3, seed: 3 },
    ];
    const playedMatches: FinalsMatchResult[] = [
      {
        id: 1,
        player1Id: P1,
        player2Id: P3,
        winnerId: P1,
        sets: [{ winnerGames: 6, loserGames: 4 }, { winnerGames: 3, loserGames: 6 }, { winnerGames: 6, loserGames: 2 }],
      },
      {
        id: 2,
        player1Id: P2,
        player2Id: P1,
        winnerId: P2,
        sets: [{ winnerGames: 6, loserGames: 3 }, { winnerGames: 6, loserGames: 2 }],
      },
    ];

    const status = computeQualificationStatus({
      participants,
      playedMatches,
      remainingPairs: [[P2, P3]],
      format: FINALS_FORMAT.tour_finals,
    });

    expect(status[P2]).toBe("qualified");
    expect(status[P1]).toBe("pending");
    expect(status[P3]).toBe("pending");
  });
});
