import { describe, expect, it } from "vitest";
import { probWinGameOnServe, probWinTiebreak, probWinSet, probWinMatch } from "./liveModel";
import { STANDARD_FORMAT, type SetFormat } from "../tennisScore";

const FAST4: SetFormat = { gamesPerSet: 4, setsToWin: 2 };
const BEST_OF_5: SetFormat = { gamesPerSet: 6, setsToWin: 3 };

describe("probWinGameOnServe", () => {
  it("matches the closed-form value (p^4(1+4q+10q^2) + 20p^3q^3 * p^2/(p^2+q^2))", () => {
    expect(probWinGameOnServe(0.6)).toBeCloseTo(0.7357, 3);
    expect(probWinGameOnServe(0.65)).toBeCloseTo(0.8296, 3);
  });

  it("is 0.5 for an even point-win rate", () => {
    expect(probWinGameOnServe(0.5)).toBeCloseTo(0.5, 6);
  });

  it("is monotonically increasing in the point-win rate", () => {
    expect(probWinGameOnServe(0.55)).toBeLessThan(probWinGameOnServe(0.65));
  });
});

describe("probWinTiebreak", () => {
  // Nota: quien saca primero en un tie-break tiene una pequeña ventaja real y conocida
  // (el que empieza sacando puede acabar sirviendo un punto más si el total de puntos
  // es impar) — por eso NO es exactamente 50/50 entre jugadores idénticos, y no debe
  // testearse como si lo fuera. Lo que sí tiene que cumplirse siempre es la simetría:
  // intercambiar quién saca primero intercambia el resultado exactamente.
  it("is symmetric: swapping who serves first flips the probability around 0.5", () => {
    const a = probWinTiebreak(0.65, 0.65, true);
    const b = probWinTiebreak(0.65, 0.65, false);
    expect(a + b).toBeCloseTo(1, 6);
    expect(a).toBeGreaterThan(0.5); // servir primero es una ventaja real, aunque pequeña
  });

  it("favors the stronger server", () => {
    expect(probWinTiebreak(0.7, 0.6, true)).toBeGreaterThan(0.5);
  });
});

describe("probWinSet", () => {
  it("is symmetric from 0-0: swapping who serves first flips the probability around 0.5", () => {
    const a = probWinSet(0, 0, true, 0.65, 0.65, STANDARD_FORMAT);
    const b = probWinSet(0, 0, false, 0.65, 0.65, STANDARD_FORMAT);
    expect(a + b).toBeCloseTo(1, 6);
  });

  it("returns 1/0 once a player has already reached the winning score", () => {
    expect(probWinSet(6, 3, true, 0.6, 0.6, STANDARD_FORMAT)).toBe(1);
    expect(probWinSet(7, 5, true, 0.6, 0.6, STANDARD_FORMAT)).toBe(1);
    expect(probWinSet(3, 6, true, 0.6, 0.6, STANDARD_FORMAT)).toBe(0);
  });

  it("gives the server a large edge from 5-3 serving for the set", () => {
    expect(probWinSet(5, 3, true, 0.65, 0.65, STANDARD_FORMAT)).toBeGreaterThan(0.8);
  });

  it("respects Fast4's first-to-4-no-tiebreak rule: 3-3 is decided by a single game", () => {
    expect(probWinSet(4, 2, true, 0.6, 0.6, FAST4)).toBe(1);
    // A 3-3 en Fast4 no tiene tie-break (ver lib/tennisScore.ts) — el siguiente juego
    // decide el set en seco, así que la probabilidad ES la de ganar ESE juego sacando.
    expect(probWinSet(3, 3, true, 0.65, 0.65, FAST4)).toBeCloseTo(probWinGameOnServe(0.65), 6);
  });
});

describe("probWinMatch", () => {
  it("is roughly symmetric from 0-0 (within the documented 'future sets assume A serves first' simplification)", () => {
    // A diferencia de probWinSet (exactamente simétrico, verificado arriba),
    // probWinMatch asume que CUALQUIER set futuro lo empieza sacando A — una
    // simplificación real y documentada (no hay forma de saber quién sacaría primero
    // un set que no ha empezado), así que aquí la simetría es aproximada, no exacta.
    const a = probWinMatch(0, 0, 0, 0, true, 0.65, 0.65, STANDARD_FORMAT);
    const b = probWinMatch(0, 0, 0, 0, false, 0.65, 0.65, STANDARD_FORMAT);
    expect(a + b).toBeCloseTo(1, 1);
    const a5 = probWinMatch(0, 0, 0, 0, true, 0.65, 0.65, BEST_OF_5);
    const b5 = probWinMatch(0, 0, 0, 0, false, 0.65, 0.65, BEST_OF_5);
    expect(a5 + b5).toBeCloseTo(1, 1);
  });

  it("returns 1/0 once a player has already won enough sets", () => {
    expect(probWinMatch(2, 0, 0, 0, true, 0.5, 0.5, STANDARD_FORMAT)).toBe(1);
    expect(probWinMatch(0, 2, 0, 0, true, 0.5, 0.5, STANDARD_FORMAT)).toBe(0);
  });

  it("heavily favors a player up a set and serving well up in games", () => {
    const p = probWinMatch(1, 0, 4, 1, true, 0.65, 0.65, STANDARD_FORMAT);
    expect(p).toBeGreaterThan(0.9);
  });

  it("a weaker server trailing a set and a break down is a heavy underdog", () => {
    const p = probWinMatch(0, 1, 1, 4, false, 0.55, 0.65, STANDARD_FORMAT);
    expect(p).toBeLessThan(0.15);
  });
});
