import { describe, expect, it } from "vitest";
import { computeFormTier, type RecentMatchOutcome } from "./opponentFormTier";

function wins(n: number, setsLostEach = 1): RecentMatchOutcome[] {
  return Array.from({ length: n }, () => ({ won: true, setsLost: setsLostEach }));
}
function losses(n: number): RecentMatchOutcome[] {
  return Array.from({ length: n }, () => ({ won: false, setsLost: 0 }));
}

describe("computeFormTier", () => {
  it("is Normal with no note for a debutant with no history", () => {
    expect(computeFormTier([])).toEqual({ tier: "Normal", note: null });
  });

  it("is Great for a 5+ match win streak, with a note", () => {
    const result = computeFormTier(wins(6));
    expect(result.tier).toBe("Great");
    expect(result.note).toContain("6-match win streak");
  });

  it("is Great for a 3-match streak dropping at most 1 set combined, even if short of 5", () => {
    const result = computeFormTier(wins(3, 0));
    expect(result.tier).toBe("Great");
    expect(result.note).toContain("3-match win streak");
    expect(result.note).toContain("0 sets");
  });

  it("is Solid for a 3-4 match win streak that DID lose more than 1 set combined", () => {
    const result = computeFormTier(wins(4, 1)); // 4 wins, 1 set lost each = 4 total, over the Great cutoff
    expect(result.tier).toBe("Solid");
    expect(result.note).toContain("4-match win streak");
  });

  it("is Solid for a strong win rate with no long streak (a loss breaks the streak but the record is still strong)", () => {
    const recent = [...losses(1), ...wins(8, 1)]; // most recent is a loss, then 8 wins before that — streak=0, winRate=8/9
    const result = computeFormTier(recent);
    expect(result.tier).toBe("Solid");
    expect(result.note).toContain("won 8 of their last 9");
  });

  it("never mentions Bad/Mediocre/Normal form (note is always null)", () => {
    // Pérdida más reciente primero a propósito, para que no se cuele una racha de
    // victorias al frente del array y falsee el resultado — `recent` va del más
    // reciente al más antiguo.
    expect(computeFormTier([...losses(5), ...wins(5, 5)]).note).toBeNull(); // winRate 0.5 -> Normal
    expect(computeFormTier([...losses(7), ...wins(3, 5)]).note).toBeNull(); // winRate 0.3 -> Mediocre
    expect(computeFormTier(losses(10)).note).toBeNull(); // winRate 0 -> Bad
  });

  it("buckets plain win rate correctly when there's no streak or hot run", () => {
    expect(computeFormTier([...losses(5), ...wins(5, 5)]).tier).toBe("Normal");
    expect(computeFormTier([...losses(7), ...wins(3, 5)]).tier).toBe("Mediocre");
    expect(computeFormTier(losses(10)).tier).toBe("Bad");
  });
});
