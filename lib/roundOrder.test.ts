import { describe, expect, it } from "vitest";
import { compareByRoundProgression, roundLabel, roundOrderRank } from "./roundOrder";

describe("roundOrderRank", () => {
  it("ordena clasificación antes que cuadro principal, y cuadro principal antes que cuartos", () => {
    const rounds = ["F", "S", "Q", "R4", "R3", "R2", "R1", "Q3", "Q2", "Q1"];
    const sorted = [...rounds].sort((a, b) => roundOrderRank(a) - roundOrderRank(b));
    expect(sorted).toEqual(["Q1", "Q2", "Q3", "R1", "R2", "R3", "R4", "Q", "S", "F"]);
  });

  it("'Q' (cuartos) y 'Q1' (clasificación) no se confunden pese al nombre parecido", () => {
    expect(roundOrderRank("Q1")).toBeLessThan(roundOrderRank("R1"));
    expect(roundOrderRank("Q")).toBeGreaterThan(roundOrderRank("R4"));
  });

  it("un código desconocido se manda al final, no rompe el orden de los demás", () => {
    const rounds = ["F", "R1", "MysteryRound", "S"];
    const sorted = [...rounds].sort((a, b) => roundOrderRank(a) - roundOrderRank(b));
    expect(sorted).toEqual(["R1", "S", "F", "MysteryRound"]);
  });
});

describe("roundLabel", () => {
  it("traduce Q/S/F a QF/SF/F, sin importar el tamaño del cuadro", () => {
    expect(roundLabel("Q")).toBe("QF");
    expect(roundLabel("S")).toBe("SF");
    expect(roundLabel("F")).toBe("F");
  });

  it("deja pasar tal cual un código sin traducción (R1..R4, Q1..Q3, o uno desconocido)", () => {
    expect(roundLabel("R3")).toBe("R3");
    expect(roundLabel("Q1")).toBe("Q1");
    expect(roundLabel("MysteryRound")).toBe("MysteryRound");
  });
});

describe("compareByRoundProgression", () => {
  it("con un grupo de partidos de la misma edición, ordena de R1 a F", () => {
    const matches = [
      { round: "R3", id: "c" },
      { round: "R4", id: "d" },
      { round: "R2", id: "b" },
      { round: "R1", id: "a" },
    ];
    matches.sort((a, b) => compareByRoundProgression(a.round, b.round));
    expect(matches.map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
  });
});
