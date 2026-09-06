import { describe, expect, it } from "vitest";
import { isCompleteMatchScore, isValidSetScore, STANDARD_FORMAT, type SetFormat } from "./tennisScore";

const FAST4: SetFormat = { gamesPerSet: 4, setsToWin: 3 };

describe("isValidSetScore", () => {
  it("acepta marcadores estándar habituales (6-x, 7-5, 7-6)", () => {
    expect(isValidSetScore(6, 4, STANDARD_FORMAT)).toBe(true);
    expect(isValidSetScore(6, 0, STANDARD_FORMAT)).toBe(true);
    expect(isValidSetScore(7, 5, STANDARD_FORMAT)).toBe(true);
    expect(isValidSetScore(7, 6, STANDARD_FORMAT)).toBe(true);
    expect(isValidSetScore(4, 6, STANDARD_FORMAT)).toBe(true); // el orden no importa
  });

  it("rechaza marcadores estándar imposibles", () => {
    expect(isValidSetScore(6, 5, STANDARD_FORMAT)).toBe(false); // hace falta rotura a 7-5
    expect(isValidSetScore(8, 6, STANDARD_FORMAT)).toBe(false);
    expect(isValidSetScore(6, 6, STANDARD_FORMAT)).toBe(false);
  });

  it("acepta marcadores Fast4 (a 4, muerte súbita a 3-3)", () => {
    expect(isValidSetScore(4, 0, FAST4)).toBe(true);
    expect(isValidSetScore(4, 2, FAST4)).toBe(true);
    expect(isValidSetScore(4, 3, FAST4)).toBe(true); // resuelto por muerte súbita a 3-3
  });

  it("rechaza un marcador Fast4 fuera de rango o de un set estándar colado por error", () => {
    expect(isValidSetScore(6, 4, FAST4)).toBe(false);
    expect(isValidSetScore(5, 3, FAST4)).toBe(false);
  });
});

describe("isCompleteMatchScore", () => {
  it("al mejor de 3: exige exactamente 2 sets para el ganador, ni más ni menos", () => {
    expect(isCompleteMatchScore([{ winnerGames: 6, loserGames: 4 }, { winnerGames: 6, loserGames: 3 }], STANDARD_FORMAT)).toBe(true);
    expect(
      isCompleteMatchScore(
        [{ winnerGames: 6, loserGames: 4 }, { winnerGames: 3, loserGames: 6 }, { winnerGames: 6, loserGames: 2 }],
        STANDARD_FORMAT,
      ),
    ).toBe(true); // 2-1
    expect(isCompleteMatchScore([{ winnerGames: 6, loserGames: 4 }], STANDARD_FORMAT)).toBe(false); // solo 1 set, no decide el partido
  });

  it("al mejor de 5: exige exactamente 3 sets para el ganador", () => {
    expect(
      isCompleteMatchScore(
        [{ winnerGames: 4, loserGames: 1 }, { winnerGames: 4, loserGames: 2 }, { winnerGames: 4, loserGames: 0 }],
        FAST4,
      ),
    ).toBe(true); // 3-0
    expect(isCompleteMatchScore([{ winnerGames: 4, loserGames: 1 }, { winnerGames: 4, loserGames: 2 }], FAST4)).toBe(false); // solo 2-0, en al mejor de 5 no basta
  });
});
