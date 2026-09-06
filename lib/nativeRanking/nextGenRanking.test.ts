import { describe, expect, it } from "vitest";
import { filterAndRerankNextGen } from "./nextGenRanking";

describe("filterAndRerankNextGen", () => {
  it("solo deja a los jugadores cuyo startYear es exactamente el año dado, y re-numera desde 1", () => {
    const entries = [
      { playerId: 1, points: 300 },
      { playerId: 2, points: 200 },
      { playerId: 3, points: 100 },
    ];
    const startYearByPlayer = new Map([
      [1, 2025],
      [2, 2026],
      [3, 2026],
    ]);
    expect(filterAndRerankNextGen(entries, startYearByPlayer, 2026)).toEqual([
      { playerId: 2, points: 200, rank: 1 },
      { playerId: 3, points: 100, rank: 2 },
    ]);
  });

  it("un jugador sin startYear (histórico importado, o reclamado sin fijarlo) nunca entra", () => {
    const entries = [{ playerId: 1, points: 300 }];
    const startYearByPlayer = new Map([[1, null]]);
    expect(filterAndRerankNextGen(entries, startYearByPlayer, 2026)).toEqual([]);
  });

  it("un jugador que ni siquiera está en el mapa (no debería pasar, pero no rompe): tratado como sin startYear", () => {
    const entries = [{ playerId: 1, points: 300 }];
    expect(filterAndRerankNextGen(entries, new Map(), 2026)).toEqual([]);
  });

  it("nadie del año dado: lista vacía", () => {
    const entries = [{ playerId: 1, points: 300 }];
    const startYearByPlayer = new Map([[1, 2020]]);
    expect(filterAndRerankNextGen(entries, startYearByPlayer, 2026)).toEqual([]);
  });
});
