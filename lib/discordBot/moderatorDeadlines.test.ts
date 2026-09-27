import { describe, expect, it } from "vitest";
import { classifyForBoard, formatBoardCard, NEAR_DEADLINE_WINDOW_MS, sortForBoard, threadJumpUrl, type BoardEntry } from "./moderatorDeadlines";

const NOW = new Date("2026-09-27T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function entry(overrides: Partial<BoardEntry>): BoardEntry {
  return {
    id: 1,
    threadId: "1000",
    eventName: "Madrid",
    roundLabel: "R16",
    player1Name: "Alice",
    player2Name: "Bob",
    effectiveDeadlineMs: NOW + 2 * HOUR,
    fullyConfirmed: false,
    lastActivityAt: null,
    player1ConfirmedAt: null,
    player2ConfirmedAt: null,
    ...overrides,
  };
}

describe("classifyForBoard", () => {
  it("skips a match with plenty of time left", () => {
    expect(classifyForBoard(entry({ effectiveDeadlineMs: NOW + NEAR_DEADLINE_WINDOW_MS + HOUR }), NOW)).toBeNull();
  });

  it("skips a match already confirmed by everyone who could confirm", () => {
    expect(classifyForBoard(entry({ fullyConfirmed: true, effectiveDeadlineMs: NOW - HOUR }), NOW)).toBeNull();
  });

  it("includes a match right at the edge of the near-deadline window", () => {
    const out = classifyForBoard(entry({ effectiveDeadlineMs: NOW + NEAR_DEADLINE_WINDOW_MS }), NOW);
    expect(out?.overdue).toBe(false);
  });

  it("marks a match past its deadline as overdue", () => {
    const out = classifyForBoard(entry({ effectiveDeadlineMs: NOW - HOUR }), NOW);
    expect(out?.overdue).toBe(true);
  });

  it("is undiscussed only when there is no message AND no confirmation from either side", () => {
    expect(classifyForBoard(entry({}), NOW)?.undiscussed).toBe(true);
    expect(classifyForBoard(entry({ lastActivityAt: NOW - HOUR }), NOW)?.undiscussed).toBe(false);
    expect(classifyForBoard(entry({ player1ConfirmedAt: NOW - HOUR }), NOW)?.undiscussed).toBe(false);
    expect(classifyForBoard(entry({ player2ConfirmedAt: NOW - HOUR }), NOW)?.undiscussed).toBe(false);
  });
});

describe("sortForBoard", () => {
  it("orders overdue-undiscussed, overdue, near-undiscussed, near — each group by closest deadline first", () => {
    const overdueDiscussed = classifyForBoard(entry({ id: 1, effectiveDeadlineMs: NOW - HOUR, lastActivityAt: NOW - 2 * HOUR }), NOW)!;
    const overdueUndiscussed = classifyForBoard(entry({ id: 2, effectiveDeadlineMs: NOW - 2 * HOUR }), NOW)!;
    const nearUndiscussed = classifyForBoard(entry({ id: 3, effectiveDeadlineMs: NOW + HOUR }), NOW)!;
    const nearDiscussed = classifyForBoard(entry({ id: 4, effectiveDeadlineMs: NOW + 30 * 60 * 1000, lastActivityAt: NOW - HOUR }), NOW)!;

    const sorted = sortForBoard([nearDiscussed, overdueDiscussed, nearUndiscussed, overdueUndiscussed]);
    expect(sorted.map((c) => c.entry.id)).toEqual([2, 1, 3, 4]);
  });
});

describe("threadJumpUrl", () => {
  it("builds a direct discord.com link to the thread", () => {
    expect(threadJumpUrl("111", "222")).toBe("https://discord.com/channels/111/222");
  });
});

describe("formatBoardCard", () => {
  it("flags an overdue, undiscussed match clearly", () => {
    const classified = classifyForBoard(entry({ effectiveDeadlineMs: NOW - HOUR }), NOW)!;
    const card = formatBoardCard("111", classified);
    expect(card.name).toContain("🔴");
    expect(card.name).toContain("Match #1");
    expect(card.value).toContain("Alice");
    expect(card.value).toContain("Bob");
    expect(card.value).toContain("No activity yet");
    expect(card.value).toContain("https://discord.com/channels/111/1000");
  });

  it("shows a near-deadline, already-discussed match without the warning", () => {
    const classified = classifyForBoard(entry({ effectiveDeadlineMs: NOW + HOUR, lastActivityAt: NOW - HOUR }), NOW)!;
    const card = formatBoardCard("111", classified);
    expect(card.name).toContain("🟡");
    expect(card.value).not.toContain("No activity yet");
  });
});
