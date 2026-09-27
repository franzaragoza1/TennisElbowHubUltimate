import { describe, expect, it } from "vitest";
import { formatFinishedMatchAnnouncement, formatLiveMatchCard, formatWaitingCard, padName } from "./liveBoardCards";
import type { RawLiveMatch } from "@/lib/liveTennis/parseLivePage";
import type { WaitingEntry } from "../waitingPlayers";
import type { GameFinished } from "../elbotMessages";

describe("padName", () => {
  it("pads a short name to the target width", () => {
    expect(padName("Ana", 6)).toBe("Ana   ");
  });

  it("truncates a too-long name with an ellipsis instead of breaking alignment", () => {
    const result = padName("A Very Long Player Name", 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith("…")).toBe(true);
  });

  it("leaves a name exactly at the width unchanged", () => {
    expect(padName("Exactly6", 8)).toBe("Exactly6");
  });
});

describe("formatLiveMatchCard", () => {
  const match: RawLiveMatch = {
    matchId: "m1",
    courtTitle: "Cincinnati ATP 1000",
    bestOf: 3,
    player1: { name: "N.Djokovic", setGames: ["6", "3"], currentPoint: "40", serving: true, elo: 1850 },
    player2: { name: "Blackninjagold3.", setGames: ["4", "5"], currentPoint: "30", serving: false, elo: 1620 },
  };

  it("names the field after the court/tournament title, marked live", () => {
    const { name } = formatLiveMatchCard(match);
    expect(name).toBe("🔴 Cincinnati ATP 1000");
  });

  it("puts both players in a code block, one row each, with their own elo and set scores", () => {
    const { value } = formatLiveMatchCard(match);
    expect(value.startsWith("```")).toBe(true);
    expect(value.endsWith("```")).toBe(true);
    expect(value).toContain("N.Djokovic");
    expect(value).toContain("Blackninjagold3");
    expect(value).toContain("1850");
    expect(value).toContain("1620");
  });

  it("marks the serving player with a dot, never the non-serving one", () => {
    const { value } = formatLiveMatchCard(match);
    const lines = value.split("\n");
    expect(lines[1].startsWith("●")).toBe(true); // player1, serving
    expect(lines[2].startsWith(" ")).toBe(true); // player2, not serving
  });

  it("falls back to 'unrated' for a player with no elo, never fabricating a number", () => {
    const noElo: RawLiveMatch = { ...match, player1: { ...match.player1, elo: null } };
    const { value } = formatLiveMatchCard(noElo);
    expect(value).toContain("unrated");
  });
});

describe("formatWaitingCard", () => {
  const entry: WaitingEntry = {
    type: "waiting",
    displayName: "Rean Coldsteel",
    elo: 1713,
    rep: 24,
    sets: 1,
    preview: "Service + Rally",
    difficulty: "Simulation",
    mode: "Realistic",
    comment: "XKT v4.4b",
    announcedAt: Date.now(),
  };

  it("names the field after the player, marked waiting", () => {
    const { name } = formatWaitingCard(entry);
    expect(name).toBe("⏳ Rean Coldsteel");
  });

  it("shows elo, rep, set count and difficulty/mode in a code block", () => {
    const { value } = formatWaitingCard(entry);
    expect(value.startsWith("```")).toBe(true);
    expect(value).toContain("1713");
    expect(value).toContain("24%");
    expect(value).toContain("1-set");
    expect(value).toContain("Simulation");
    expect(value).toContain("Realistic");
  });

  it("handles a negative rep percentage correctly, not as a formatting glitch", () => {
    const { value } = formatWaitingCard({ ...entry, rep: -42 });
    expect(value).toContain("-42%");
  });
});

describe("formatFinishedMatchAnnouncement", () => {
  it("shows the winner, loser and raw score exactly as elbot gave them", () => {
    const event: GameFinished = { type: "finished", winnerShort: "[.Pliskova", loserShort: "Jele", score: "7-6" };
    expect(formatFinishedMatchAnnouncement(event)).toBe("✅ **[.Pliskova** def. **Jele** — `7-6`");
  });

  it("keeps a multi-set score as one string, never split apart", () => {
    const event: GameFinished = { type: "finished", winnerShort: "X3NOX_BoB", loserShort: "ChoLaFree", score: "6-7 6-0 6-2" };
    expect(formatFinishedMatchAnnouncement(event)).toContain("`6-7 6-0 6-2`");
  });
});
