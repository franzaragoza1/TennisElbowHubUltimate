import { describe, expect, it } from "vitest";
import { mergeOngoingPoints } from "./liveRanking";

describe("mergeOngoingPoints", () => {
  it("suma los puntos en curso a un jugador que ya tenía puntos oficiales", () => {
    const official = [{ playerId: 1, points: 100 }];
    const ongoing = new Map([[1, { points: 50 }]]);
    expect(mergeOngoingPoints(official, ongoing)).toEqual([{ playerId: 1, points: 150 }]);
  });

  it("debutante: solo aparece en `ongoing`, entra con base 0", () => {
    const official = [{ playerId: 1, points: 100 }];
    const ongoing = new Map([
      [1, { points: 50 }],
      [2, { points: 30 }],
    ]);
    expect(mergeOngoingPoints(official, ongoing)).toEqual([
      { playerId: 1, points: 150 },
      { playerId: 2, points: 30 },
    ]);
  });

  it("jugador sin puntos en curso: no cambia", () => {
    const official = [{ playerId: 1, points: 100 }];
    expect(mergeOngoingPoints(official, new Map())).toEqual([{ playerId: 1, points: 100 }]);
  });

  it("nadie en curso: devuelve la lista oficial tal cual", () => {
    const official = [
      { playerId: 1, points: 100 },
      { playerId: 2, points: 200 },
    ];
    expect(mergeOngoingPoints(official, new Map())).toEqual(official);
  });
});
