import { describe, expect, it } from "vitest";
import { FINALS_FORMAT, isCompleteMatchScore, isValidSetScore } from "./format";

const TOUR_FINALS = FINALS_FORMAT.tour_finals; // al mejor de 3, sets a 6
const NEXT_GEN = FINALS_FORMAT.next_gen_finals; // al mejor de 5, Fast4 a 4

describe("isValidSetScore", () => {
  it("acepta marcadores estándar habituales (6-x, 7-5, 7-6)", () => {
    expect(isValidSetScore(6, 4, TOUR_FINALS)).toBe(true);
    expect(isValidSetScore(6, 0, TOUR_FINALS)).toBe(true);
    expect(isValidSetScore(7, 5, TOUR_FINALS)).toBe(true);
    expect(isValidSetScore(7, 6, TOUR_FINALS)).toBe(true);
    expect(isValidSetScore(4, 6, TOUR_FINALS)).toBe(true); // el orden no importa
  });

  it("rechaza marcadores estándar imposibles", () => {
    expect(isValidSetScore(6, 5, TOUR_FINALS)).toBe(false); // hace falta rotura a 7-5
    expect(isValidSetScore(8, 6, TOUR_FINALS)).toBe(false);
    expect(isValidSetScore(6, 6, TOUR_FINALS)).toBe(false);
  });

  it("acepta marcadores Fast4 (a 4, muerte súbita a 3-3)", () => {
    expect(isValidSetScore(4, 0, NEXT_GEN)).toBe(true);
    expect(isValidSetScore(4, 2, NEXT_GEN)).toBe(true);
    expect(isValidSetScore(4, 3, NEXT_GEN)).toBe(true); // resuelto por muerte súbita a 3-3
  });

  it("rechaza un marcador Fast4 fuera de rango o de un set estándar colado por error", () => {
    expect(isValidSetScore(6, 4, NEXT_GEN)).toBe(false);
    expect(isValidSetScore(5, 3, NEXT_GEN)).toBe(false);
  });
});

describe("isCompleteMatchScore", () => {
  it("World Tour Finals: exige exactamente 2 sets para el ganador, ni más ni menos", () => {
    expect(isCompleteMatchScore([{ winnerGames: 6, loserGames: 4 }, { winnerGames: 6, loserGames: 3 }], TOUR_FINALS)).toBe(true);
    expect(
      isCompleteMatchScore(
        [{ winnerGames: 6, loserGames: 4 }, { winnerGames: 3, loserGames: 6 }, { winnerGames: 6, loserGames: 2 }],
        TOUR_FINALS,
      ),
    ).toBe(true); // 2-1
    expect(isCompleteMatchScore([{ winnerGames: 6, loserGames: 4 }], TOUR_FINALS)).toBe(false); // solo 1 set, no decide el partido
  });

  it("Next Gen Finals: exige exactamente 3 sets para el ganador", () => {
    expect(
      isCompleteMatchScore(
        [{ winnerGames: 4, loserGames: 1 }, { winnerGames: 4, loserGames: 2 }, { winnerGames: 4, loserGames: 0 }],
        NEXT_GEN,
      ),
    ).toBe(true); // 3-0
    expect(
      isCompleteMatchScore([{ winnerGames: 4, loserGames: 1 }, { winnerGames: 4, loserGames: 2 }], NEXT_GEN),
    ).toBe(false); // solo 2-0, en al mejor de 5 no basta
  });
});
