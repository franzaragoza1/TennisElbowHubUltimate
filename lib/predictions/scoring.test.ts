import { describe, expect, it } from "vitest";
import { pointsForRoundIndex, scorePrediction, type BracketPick } from "./scoring";
import type { BracketLayout, BracketMatchInput, PositionedMatch } from "../bracket";

function slot(id: number, round: string, player1Id: number, player2Id: number, winnerId: number | null, sortIndex = 0): PositionedMatch<BracketMatchInput> {
  return { match: { id, round, player1Id, player2Id, winnerId, sortIndex }, round, y: 0, player1FeederId: null, player2FeederId: null };
}

describe("pointsForRoundIndex", () => {
  it("doubles every round starting at 1", () => {
    expect(pointsForRoundIndex(0)).toBe(1);
    expect(pointsForRoundIndex(1)).toBe(2);
    expect(pointsForRoundIndex(2)).toBe(4);
    expect(pointsForRoundIndex(4)).toBe(16);
  });
});

describe("scorePrediction", () => {
  it("scores a partially-decided bracket only on the rounds with real results", () => {
    const layout: BracketLayout<BracketMatchInput> = {
      roundOrder: ["R1", "F"],
      matchesByRound: new Map([
        ["R1", [slot(1, "R1", 1, 2, 1), slot(2, "R1", 3, 4, null)]],
        ["F", [slot(3, "F", 1, 0, null)]], // depende del R1 sin decidir todavía — sin ganador real aún
      ]),
      positionById: new Map(),
    };
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 1 }, // acierto
      { round: "R1", slotIndex: 1, playerId: 3 }, // sin decidir todavía, no cuenta
      { round: "F", slotIndex: 0, playerId: 1 }, // sin decidir todavía, no cuenta
    ];

    const result = scorePrediction(picks, layout);
    expect(result.byRound).toEqual([
      { round: "R1", correct: 1, possible: 1, points: 1 },
      { round: "F", correct: 0, possible: 0, points: 0 },
    ]);
    expect(result.total).toBe(1);
  });

  it("scores zero for a wrong pick without affecting other slots", () => {
    const layout: BracketLayout<BracketMatchInput> = {
      roundOrder: ["R1"],
      matchesByRound: new Map([["R1", [slot(1, "R1", 1, 2, 1), slot(2, "R1", 3, 4, 4)]]]),
      positionById: new Map(),
    };
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 2 }, // fallo (el ganador real fue 1)
      { round: "R1", slotIndex: 1, playerId: 4 }, // acierto
    ];

    const result = scorePrediction(picks, layout);
    expect(result.byRound).toEqual([{ round: "R1", correct: 1, possible: 2, points: 1 }]);
    expect(result.total).toBe(1);
  });

  it("scores a fully-decided bracket across every round, doubling per round", () => {
    const layout: BracketLayout<BracketMatchInput> = {
      roundOrder: ["R1", "F"],
      matchesByRound: new Map([
        ["R1", [slot(1, "R1", 1, 2, 1), slot(2, "R1", 3, 4, 3)]],
        ["F", [slot(3, "F", 1, 3, 1)]],
      ]),
      positionById: new Map(),
    };
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 0, playerId: 1 },
      { round: "R1", slotIndex: 1, playerId: 3 },
      { round: "F", slotIndex: 0, playerId: 1 },
    ];

    const result = scorePrediction(picks, layout);
    expect(result.byRound).toEqual([
      { round: "R1", correct: 2, possible: 2, points: 2 }, // 2 aciertos x 1pt
      { round: "F", correct: 1, possible: 1, points: 2 }, // 1 acierto x 2pts
    ]);
    expect(result.total).toBe(4);
  });

  it("a missing pick for a decided slot simply scores zero for it", () => {
    const layout: BracketLayout<BracketMatchInput> = {
      roundOrder: ["R1"],
      matchesByRound: new Map([["R1", [slot(1, "R1", 1, 2, 1)]]]),
      positionById: new Map(),
    };
    const result = scorePrediction([], layout);
    expect(result.byRound).toEqual([{ round: "R1", correct: 0, possible: 1, points: 0 }]);
    expect(result.total).toBe(0);
  });
});
