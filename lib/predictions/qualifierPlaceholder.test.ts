import { describe, expect, it } from "vitest";
import { applyQualifierResolution, encodeQualifierPlaceholderId, QUALIFIER_ID_BASE, type QualifierSlotResolution } from "./qualifierPlaceholder";
import type { BracketPick } from "./scoring";

describe("encodeQualifierPlaceholderId", () => {
  it("is always above the reserved base, distinct per sortIndex and side", () => {
    const a = encodeQualifierPlaceholderId(1, "player1");
    const b = encodeQualifierPlaceholderId(1, "player2");
    const c = encodeQualifierPlaceholderId(2, "player1");
    expect(a).toBeGreaterThanOrEqual(QUALIFIER_ID_BASE);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("applyQualifierResolution", () => {
  it("leaves picks untouched when nothing is resolved yet", () => {
    const picks: BracketPick[] = [{ round: "R1", slotIndex: 1, playerId: encodeQualifierPlaceholderId(1, "player1") }];
    const resolution: QualifierSlotResolution = new Map([[1, { player1Id: null, player2Id: 109 }]]);
    expect(applyQualifierResolution(picks, resolution)).toEqual(picks);
  });

  it("substitutes the real player once the qualifier slot resolves", () => {
    const picks: BracketPick[] = [{ round: "R1", slotIndex: 1, playerId: encodeQualifierPlaceholderId(1, "player1") }];
    const resolution: QualifierSlotResolution = new Map([[1, { player1Id: 487, player2Id: 109 }]]);
    expect(applyQualifierResolution(picks, resolution)).toEqual([{ round: "R1", slotIndex: 1, playerId: 487 }]);
  });

  it("resolves the correct side independently for a match with two qualifier slots", () => {
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 4, playerId: encodeQualifierPlaceholderId(4, "player1") },
      { round: "R1", slotIndex: 4, playerId: encodeQualifierPlaceholderId(4, "player2") },
    ];
    const resolution: QualifierSlotResolution = new Map([[4, { player1Id: 11, player2Id: 22 }]]);
    expect(applyQualifierResolution(picks, resolution)).toEqual([
      { round: "R1", slotIndex: 4, playerId: 11 },
      { round: "R1", slotIndex: 4, playerId: 22 },
    ]);
  });

  it("leaves a cascaded later-round pick pointing at the same origin slot resolvable too", () => {
    // El usuario hizo avanzar al "Qualifier #N" de R1 slot 1 hasta su propio pick de R2 —
    // el mismo id sintético reaparece ahí, sin necesidad de tratarlo distinto.
    const picks: BracketPick[] = [
      { round: "R1", slotIndex: 1, playerId: encodeQualifierPlaceholderId(1, "player1") },
      { round: "R2", slotIndex: 0, playerId: encodeQualifierPlaceholderId(1, "player1") },
    ];
    const resolution: QualifierSlotResolution = new Map([[1, { player1Id: 487, player2Id: 109 }]]);
    expect(applyQualifierResolution(picks, resolution)).toEqual([
      { round: "R1", slotIndex: 1, playerId: 487 },
      { round: "R2", slotIndex: 0, playerId: 487 },
    ]);
  });

  it("passes through a normal, non-placeholder pick unchanged", () => {
    const picks: BracketPick[] = [{ round: "R1", slotIndex: 0, playerId: 42 }];
    const resolution: QualifierSlotResolution = new Map([[1, { player1Id: 487, player2Id: 109 }]]);
    expect(applyQualifierResolution(picks, resolution)).toEqual(picks);
  });

  it("returns picks unchanged when the resolution map is empty", () => {
    const picks: BracketPick[] = [{ round: "R1", slotIndex: 1, playerId: encodeQualifierPlaceholderId(1, "player1") }];
    expect(applyQualifierResolution(picks, new Map())).toBe(picks);
  });
});
