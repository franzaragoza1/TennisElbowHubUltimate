import { describe, expect, it } from "vitest";
import { extractMarqueePicks, getPlayerExitRound } from "./marqueePicks";
import type { BracketPick } from "./scoring";
import type { BracketLayout, BracketMatchInput } from "../bracket";

/** Cuadro de 8 (Q/S/F) con Q parcialmente decidido — Q2 sigue abierto, el resto ya
 * tiene resultado real. Sirve para probar que `extractMarqueePicks` mezcla resultados
 * reales (Q0/Q1/Q3) con el propio pick de la entrega (Q2) sin distinguirlos. */
function buildPartialLayout(): BracketLayout<BracketMatchInput> {
  return {
    roundOrder: ["Q", "S", "F"],
    matchesByRound: new Map([
      [
        "Q",
        [
          { match: { id: 1, round: "Q", player1Id: 1, player2Id: 2, winnerId: 1, sortIndex: 0 }, round: "Q", y: 0, player1FeederId: null, player2FeederId: null },
          { match: { id: 2, round: "Q", player1Id: 3, player2Id: 4, winnerId: 4, sortIndex: 1 }, round: "Q", y: 1, player1FeederId: null, player2FeederId: null },
          { match: { id: 3, round: "Q", player1Id: 5, player2Id: 6, winnerId: null, sortIndex: 2 }, round: "Q", y: 2, player1FeederId: null, player2FeederId: null },
          { match: { id: 4, round: "Q", player1Id: 7, player2Id: 8, winnerId: 7, sortIndex: 3 }, round: "Q", y: 3, player1FeederId: null, player2FeederId: null },
        ],
      ],
      [
        "S",
        [
          { match: { id: 5, round: "S", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 0 }, round: "S", y: 0.5, player1FeederId: 1, player2FeederId: 2 },
          { match: { id: 6, round: "S", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 1 }, round: "S", y: 2.5, player1FeederId: 3, player2FeederId: 4 },
        ],
      ],
      ["F", [{ match: { id: 7, round: "F", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 0 }, round: "F", y: 1.5, player1FeederId: 5, player2FeederId: 6 }]],
    ]),
    positionById: new Map(),
  };
}

describe("extractMarqueePicks", () => {
  it("mezcla resultados reales ya decididos con los picks propios de la entrega, cascada incluida", () => {
    const picks: BracketPick[] = [
      { round: "Q", slotIndex: 2, playerId: 5 }, // el único hueco de Q todavía abierto
      { round: "S", slotIndex: 0, playerId: 1 }, // entre los ganadores reales de Q0/Q1 (1, 4)
      { round: "S", slotIndex: 1, playerId: 7 }, // entre el propio pick de Q2 (5) y el ganador real de Q3 (7)
      { round: "F", slotIndex: 0, playerId: 7 }, // entre los propios picks de S0/S1 (1, 7)
    ];
    expect(extractMarqueePicks(picks, buildPartialLayout())).toEqual({
      championId: 7,
      finalistId: 1, // el otro candidato de la final que no ganó
      semifinalist1Id: 4, // perdió el hueco S0 según esta entrega (ganó 1)
      semifinalist2Id: 5, // perdió el hueco S1 según esta entrega (ganó 7)
    });
  });

  it("da todo null si la entrega no llega ni a la final", () => {
    expect(extractMarqueePicks([], buildPartialLayout())).toEqual({
      championId: null,
      finalistId: null,
      semifinalist1Id: null,
      semifinalist2Id: null,
    });
  });

  it("mantiene el pick original aunque el resultado real que llega después lo contradiga (bug real, 2026-09-18)", () => {
    // Mismo cuadro que buildCompleteLayout: TODO ya decidido de verdad (F: 1 vence a 7),
    // pero esta entrega se envió antes de que nada se jugara y picó justo lo contrario
    // en la final. El cartel debe reflejar lo que esta persona predijo, no el resultado
    // real — si no, la clasificación entera converge al resultado real en cuanto el
    // torneo termina, sin importar qué picó cada quien.
    const picks: BracketPick[] = [
      { round: "S", slotIndex: 0, playerId: 1 },
      { round: "S", slotIndex: 1, playerId: 7 },
      { round: "F", slotIndex: 0, playerId: 7 }, // la entrega picó a 7 campeón; en la realidad ganó 1
    ];
    expect(extractMarqueePicks(picks, buildCompleteLayout())).toEqual({
      championId: 7,
      finalistId: 1,
      semifinalist1Id: 4,
      semifinalist2Id: 5,
    });
  });
});

/** Mismo cuadro de 8, pero completamente decidido de verdad — para probar los 3
 * desenlaces reales de `getPlayerExitRound` (campeón, eliminado en una ronda concreta,
 * nunca jugó). */
function buildCompleteLayout(): BracketLayout<BracketMatchInput> {
  return {
    roundOrder: ["Q", "S", "F"],
    matchesByRound: new Map([
      [
        "Q",
        [
          { match: { id: 1, round: "Q", player1Id: 1, player2Id: 2, winnerId: 1, sortIndex: 0 }, round: "Q", y: 0, player1FeederId: null, player2FeederId: null },
          { match: { id: 2, round: "Q", player1Id: 3, player2Id: 4, winnerId: 4, sortIndex: 1 }, round: "Q", y: 1, player1FeederId: null, player2FeederId: null },
          { match: { id: 3, round: "Q", player1Id: 5, player2Id: 6, winnerId: 5, sortIndex: 2 }, round: "Q", y: 2, player1FeederId: null, player2FeederId: null },
          { match: { id: 4, round: "Q", player1Id: 7, player2Id: 8, winnerId: 7, sortIndex: 3 }, round: "Q", y: 3, player1FeederId: null, player2FeederId: null },
        ],
      ],
      [
        "S",
        [
          { match: { id: 5, round: "S", player1Id: 1, player2Id: 4, winnerId: 1, sortIndex: 0 }, round: "S", y: 0.5, player1FeederId: 1, player2FeederId: 2 },
          { match: { id: 6, round: "S", player1Id: 5, player2Id: 7, winnerId: 7, sortIndex: 1 }, round: "S", y: 2.5, player1FeederId: 3, player2FeederId: 4 },
        ],
      ],
      ["F", [{ match: { id: 7, round: "F", player1Id: 1, player2Id: 7, winnerId: 1, sortIndex: 0 }, round: "F", y: 1.5, player1FeederId: 5, player2FeederId: 6 }]],
    ]),
    positionById: new Map(),
  };
}

describe("getPlayerExitRound", () => {
  const layout = buildCompleteLayout();

  it("campeón: ganó la última ronda del cuadro", () => {
    expect(getPlayerExitRound(layout, 1)).toEqual({ kind: "champion" });
  });

  it("eliminado en la final", () => {
    expect(getPlayerExitRound(layout, 7)).toEqual({ kind: "eliminated", round: "F" });
  });

  it("eliminado en semifinales", () => {
    expect(getPlayerExitRound(layout, 4)).toEqual({ kind: "eliminated", round: "S" });
    expect(getPlayerExitRound(layout, 5)).toEqual({ kind: "eliminated", round: "S" });
  });

  it("eliminado en la primera ronda", () => {
    expect(getPlayerExitRound(layout, 2)).toEqual({ kind: "eliminated", round: "Q" });
  });

  it("nunca aparece en ningún partido decidido de este cuadro", () => {
    expect(getPlayerExitRound(layout, 999)).toBeNull();
  });

  it("null para playerId null", () => {
    expect(getPlayerExitRound(layout, null)).toBeNull();
  });

  it("sigue vivo: ganó una ronda que no es la última, sin partido decidido más allá todavía", () => {
    const stillOngoing: BracketLayout<BracketMatchInput> = {
      roundOrder: ["Q", "S", "F"],
      matchesByRound: new Map([
        ["Q", [{ match: { id: 1, round: "Q", player1Id: 1, player2Id: 2, winnerId: 1, sortIndex: 0 }, round: "Q", y: 0, player1FeederId: null, player2FeederId: null }]],
        ["S", [{ match: { id: 2, round: "S", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 0 }, round: "S", y: 0, player1FeederId: 1, player2FeederId: null }]],
        ["F", [{ match: { id: 3, round: "F", player1Id: -2, player2Id: -2, winnerId: null, sortIndex: 0 }, round: "F", y: 0, player1FeederId: 2, player2FeederId: null }]],
      ]),
      positionById: new Map(),
    };
    expect(getPlayerExitRound(stillOngoing, 1)).toEqual({ kind: "alive" });
  });
});
