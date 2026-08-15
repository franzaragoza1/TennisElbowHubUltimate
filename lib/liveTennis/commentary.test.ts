import { describe, expect, it } from "vitest";
import { detectBreak, liveCommentary, singleSnapshotCommentary } from "./commentary";
import type { LiveMatchPlayer, LiveTourMatch } from "./resolveAgainstOngoing";

function player(overrides: Partial<LiveMatchPlayer> & { id: number; displayName: string }): LiveMatchPlayer {
  return {
    country: null,
    seed: null,
    setGames: [],
    currentPoint: "0",
    serving: false,
    ...overrides,
  };
}

function match(player1: LiveMatchPlayer, player2: LiveMatchPlayer): LiveTourMatch {
  return { editionId: 1, tournamentName: "Cincinnati", round: "R4", drawSize: 64, player1, player2 };
}

describe("singleSnapshotCommentary", () => {
  it("calls deuce when both are at 40", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "40", serving: true, setGames: ["3"] }),
      player({ id: 2, displayName: "B", currentPoint: "40", setGames: ["2"] }),
    );
    expect(singleSnapshotCommentary(m)?.kind).toBe("deuce");
  });

  it("gives game point to the server when they're at 40 and the returner isn't", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "40", serving: true, setGames: ["3"] }),
      player({ id: 2, displayName: "B", currentPoint: "15", setGames: ["2"] }),
    );
    const c = singleSnapshotCommentary(m);
    expect(c?.kind).toBe("game-point");
    expect(c?.player.displayName).toBe("A");
  });

  it("gives break point to the returner when they're at 40 and the server isn't", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "15", serving: true, setGames: ["3"] }),
      player({ id: 2, displayName: "B", currentPoint: "40", setGames: ["2"] }),
    );
    const c = singleSnapshotCommentary(m);
    expect(c?.kind).toBe("break-point");
    expect(c?.player.displayName).toBe("B");
  });

  it("treats Ad as game point for whoever holds it", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "40", serving: true, setGames: ["5"] }),
      player({ id: 2, displayName: "B", currentPoint: "Ad", setGames: ["4"] }),
    );
    const c = singleSnapshotCommentary(m);
    expect(c?.kind).toBe("break-point");
    expect(c?.player.displayName).toBe("B");
  });

  it("escalates to set point when winning the game would also win the set (server, no completed sets yet)", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "40", serving: true, setGames: ["5"] }),
      player({ id: 2, displayName: "B", currentPoint: "15", setGames: ["3"] }),
    );
    const c = singleSnapshotCommentary(m);
    expect(c?.kind).toBe("set-point");
    expect(c?.player.displayName).toBe("A");
  });

  it("does not call 6-6 in games a set point — that's tiebreak territory we can't read", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "40", serving: true, setGames: ["6"] }),
      player({ id: 2, displayName: "B", currentPoint: "15", setGames: ["6"] }),
    );
    // Juegos ya "decididos" en la lectura literal (6-6 no es un final de set válido),
    // así que ni siquiera cuenta como set point — cae a game point sin más.
    const c = singleSnapshotCommentary(m);
    expect(c?.kind).toBe("game-point");
  });

  it('phrases match point on serve as "X serves for the match"', () => {
    const m = match(
      player({ id: 1, displayName: "Gyrmik", currentPoint: "40", serving: true, setGames: ["6", "5"] }),
      player({ id: 2, displayName: "Dani21", currentPoint: "15", setGames: ["3", "3"] }),
    );
    expect(liveCommentary(m)).toBe("Gyrmik serves for the match");
  });

  it('phrases the server\'s side of an opponent match point as "X serves to stay in the match"', () => {
    const m = match(
      player({ id: 1, displayName: "Gyrmik", currentPoint: "15", serving: true, setGames: ["3", "3"] }),
      player({ id: 2, displayName: "Dani21", currentPoint: "40", setGames: ["6", "5"] }),
    );
    expect(liveCommentary(m)).toBe("Gyrmik serves to stay in the match");
  });

  it("returns null for an unrecognized point label instead of guessing", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "TB-3", serving: true, setGames: ["6"] }),
      player({ id: 2, displayName: "B", currentPoint: "TB-2", setGames: ["6"] }),
    );
    expect(singleSnapshotCommentary(m)).toBeNull();
  });

  it("returns null when nobody is flagged as serving", () => {
    const m = match(
      player({ id: 1, displayName: "A", currentPoint: "40", setGames: ["3"] }),
      player({ id: 2, displayName: "B", currentPoint: "15", setGames: ["2"] }),
    );
    expect(singleSnapshotCommentary(m)).toBeNull();
  });
});

describe("detectBreak", () => {
  it("reports a break when serve flips and only the new server's (former returner's) games went up", () => {
    const previous = match(
      player({ id: 1, displayName: "A", serving: true, setGames: ["3"] }),
      player({ id: 2, displayName: "B", setGames: ["2"] }),
    );
    const current = match(
      player({ id: 1, displayName: "A", setGames: ["3"] }),
      player({ id: 2, displayName: "B", serving: true, setGames: ["3"] }),
    );
    expect(detectBreak(previous, current)).toBe("B breaks");
  });

  it("reports nothing when the same player is still serving (held, no break)", () => {
    const previous = match(
      player({ id: 1, displayName: "A", serving: true, setGames: ["3"] }),
      player({ id: 2, displayName: "B", setGames: ["2"] }),
    );
    const current = match(
      player({ id: 1, displayName: "A", serving: true, setGames: ["4"] }),
      player({ id: 2, displayName: "B", setGames: ["2"] }),
    );
    expect(detectBreak(previous, current)).toBeNull();
  });

  it("reports nothing without a previous snapshot", () => {
    const current = match(
      player({ id: 1, displayName: "A", setGames: ["3"] }),
      player({ id: 2, displayName: "B", serving: true, setGames: ["3"] }),
    );
    expect(detectBreak(undefined, current)).toBeNull();
  });

  it("reports nothing when the set count changed between polls (ambiguous, new set started)", () => {
    const previous = match(
      player({ id: 1, displayName: "A", serving: true, setGames: ["6"] }),
      player({ id: 2, displayName: "B", setGames: ["4"] }),
    );
    const current = match(
      player({ id: 1, displayName: "A", setGames: ["6", "0"] }),
      player({ id: 2, displayName: "B", serving: true, setGames: ["4", "1"] }),
    );
    expect(detectBreak(previous, current)).toBeNull();
  });

  it("liveCommentary prefers a just-detected break over the current point state", () => {
    const previous = match(
      player({ id: 1, displayName: "A", serving: true, setGames: ["3"], currentPoint: "40" }),
      player({ id: 2, displayName: "B", setGames: ["2"], currentPoint: "30" }),
    );
    const current = match(
      player({ id: 1, displayName: "A", setGames: ["3"], currentPoint: "0" }),
      player({ id: 2, displayName: "B", serving: true, setGames: ["3"], currentPoint: "0" }),
    );
    expect(liveCommentary(current, previous)).toBe("B breaks");
  });
});
