import { describe, expect, it } from "vitest";
import { computeSecuredPoints } from "./roundPoints";

// Escalera + puntos de un cuadro de 16 real (Cincinnati 2021, Trn=1849): R1=10, Q=200,
// S=400, F=650, W=1000.
const ladder = ["R1", "Q", "S", "F"];
const pointsByRound = { R1: 10, Q: 200, S: 400, F: 650, W: 1000 };

describe("computeSecuredPoints", () => {
  it("campeón (gana la F) se lleva los puntos de W, no de F", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, [
      { round: "R1", won: true },
      { round: "Q", won: true },
      { round: "S", won: true },
      { round: "F", won: true },
    ]);
    expect(result).toEqual({ points: 1000, round: "W", isChampion: true });
  });

  it("subcampeón (pierde la F) se queda en los puntos de F", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, [
      { round: "R1", won: true },
      { round: "Q", won: true },
      { round: "S", won: true },
      { round: "F", won: false },
    ]);
    expect(result).toEqual({ points: 650, round: "F", isChampion: false });
  });

  it("eliminado en primera ronda se queda en los puntos de esa ronda", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, [{ round: "R1", won: false }]);
    expect(result).toEqual({ points: 10, round: "R1", isChampion: false });
  });

  it("todavía vivo (ganó R1 y Q, S sin decidir): asegurado hasta S", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, [
      { round: "R1", won: true },
      { round: "Q", won: true },
    ]);
    expect(result).toEqual({ points: 400, round: "S", isChampion: false });
  });

  it("sin partidos decididos todavía: cero puntos", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, []);
    expect(result).toEqual({ points: 0, round: null, isChampion: false });
  });

  it("ronda ganada que no está en la escalera: no avanza, cero por no inventar", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, [{ round: "Q1", won: true }]);
    expect(result).toEqual({ points: 0, round: null, isChampion: false });
  });

  it("falta el valor de puntos para esa ronda en la tabla: 0, no se inventa", () => {
    const result = computeSecuredPoints(ladder, {}, [{ round: "R1", won: false }]);
    expect(result).toEqual({ points: 0, round: "R1", isChampion: false });
  });

  it("elimina la ambigüedad si hay una derrota Y victorias previas: manda la derrota", () => {
    const result = computeSecuredPoints(ladder, pointsByRound, [
      { round: "R1", won: true },
      { round: "Q", won: false },
    ]);
    expect(result).toEqual({ points: 200, round: "Q", isChampion: false });
  });
});
