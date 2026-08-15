import { describe, expect, it } from "vitest";
import { parseQuickInputBlock, parseQuickResultLine } from "./quickInput";

describe("parseQuickResultLine", () => {
  it("reconoce 'def.' con separador de barra y tie-break entre paréntesis", () => {
    expect(parseQuickResultLine("M. Arnaldi def. J.I 6/4 7/6(5)")).toEqual({
      winnerName: "M. Arnaldi",
      loserName: "J.I",
      outcome: "played",
      sets: [
        { winnerGames: 6, loserGames: 4, tiebreakLoserPoints: null },
        { winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 5 },
      ],
    });
  });

  it("reconoce 'd.' con separador de guion y tres sets", () => {
    expect(parseQuickResultLine("lord goatic d. Tomico 6-2 3-6 6-4")).toEqual({
      winnerName: "lord goatic",
      loserName: "Tomico",
      outcome: "played",
      sets: [
        { winnerGames: 6, loserGames: 2, tiebreakLoserPoints: null },
        { winnerGames: 3, loserGames: 6, tiebreakLoserPoints: null },
        { winnerGames: 6, loserGames: 4, tiebreakLoserPoints: null },
      ],
    });
  });

  it("reconoce el sufijo de retirada y conserva el marcador parcial ya jugado", () => {
    const parsed = parseQuickResultLine("Shomyleee def. Fadvna 6/4 1/1 ret.");
    expect(parsed?.outcome).toBe("retired");
    expect(parsed?.sets).toEqual([
      { winnerGames: 6, loserGames: 4, tiebreakLoserPoints: null },
      { winnerGames: 1, loserGames: 1, tiebreakLoserPoints: null },
    ]);
  });

  it("reconoce walkover", () => {
    expect(parseQuickResultLine("Deatekk def. Pecajordan w.o.")).toBeNull(); // sin sets no hay nada que guardar como marcador
  });

  it("devuelve null si no hay conector reconocible", () => {
    expect(parseQuickResultLine("Deatekk vs Pecajordan 6/4 6/2")).toBeNull();
  });

  it("devuelve null si no hay marcador", () => {
    expect(parseQuickResultLine("Deatekk def. Pecajordan")).toBeNull();
  });
});

describe("parseQuickInputBlock", () => {
  it("parsea varias líneas, ignora las vacías y marca la que no encaja", () => {
    const block = [
      "M. Arnaldi def. J.I 6/4 7/6(5)",
      "",
      "lord goatic d. Tomico 6-2 3-6 6-4",
      "esto no es un resultado",
    ].join("\n");

    const results = parseQuickInputBlock(block);
    expect(results).toHaveLength(3); // la línea vacía no cuenta
    expect(results[0].parsed?.winnerName).toBe("M. Arnaldi");
    expect(results[1].parsed?.winnerName).toBe("lord goatic");
    expect(results[2].parsed).toBeNull();
    expect(results[2].error).not.toBeNull();
    expect(results[2].lineNumber).toBe(4); // conserva el número de línea original, no el índice tras filtrar
  });
});
