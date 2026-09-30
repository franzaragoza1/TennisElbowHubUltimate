import { describe, expect, it } from "vitest";
import { compareMatchRecency, type ChronologyRow } from "./matchChronology";

const row = (round: string, recencyKey: string, drawSize = 32): ChronologyRow => ({ round, recencyKey, drawSize });

describe("compareMatchRecency", () => {
  it("orders by recencyKey first, whatever the round", () => {
    const older = row("F", "2026-09-01");
    const newer = row("R1", "2026-09-08");
    expect(compareMatchRecency(newer, older)).toBeLessThan(0);
    expect(compareMatchRecency(older, newer)).toBeGreaterThan(0);
  });

  it("breaks a tie within the same tournament by round-ladder position, final last", () => {
    const week = "2026-09-21";
    const r1 = row("R1", week);
    const r2 = row("R2", week);
    const qf = row("Q", week);
    const sf = row("S", week);
    const f = row("F", week);
    const shuffled = [r2, f, r1, sf, qf];
    shuffled.sort(compareMatchRecency);
    expect(shuffled.map((r) => r.round)).toEqual(["F", "S", "Q", "R2", "R1"]);
  });

  it("reproduces the real bug scenario: a final loss must outrank an earlier-round win from the same week", () => {
    const week = "2026-09-21";
    const earlierWin = row("R2", week);
    const finalLoss = row("F", week);
    const sorted = [earlierWin, finalLoss].sort(compareMatchRecency);
    expect(sorted[0].round).toBe("F");
  });

  it("is transitive/stable enough to sort a mixed multi-tournament list correctly", () => {
    const rows = [
      row("R1", "2026-09-28"), // Beijing R1
      row("F", "2026-09-21"), // Chengdu F (loss) — must rank ABOVE Chengdu's earlier wins
      row("R2", "2026-09-21"), // Chengdu R2 (win)
      row("R2", "2026-09-28"), // Beijing R2
      row("Q", "2026-09-21"), // Chengdu Q (win)
    ];
    const sorted = [...rows].sort(compareMatchRecency);
    // Beijing (newer week) first, R2 before R1 within it; then Chengdu's F before its
    // earlier rounds, even though F is a loss and R2/Q are wins.
    expect(sorted.map((r) => `${r.recencyKey}:${r.round}`)).toEqual([
      "2026-09-28:R2",
      "2026-09-28:R1",
      "2026-09-21:F",
      "2026-09-21:Q",
      "2026-09-21:R2",
    ]);
  });
});
