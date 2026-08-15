import { describe, expect, it } from "vitest";
import { filterCandidates } from "./filterCandidates";
import type { RawLiveMatch, RawLivePlayer } from "./parseLivePage";

function player(name: string): RawLivePlayer {
  return { name, setGames: ["1"], currentPoint: "0", serving: false };
}

function match(overrides: Partial<RawLiveMatch>): RawLiveMatch {
  return {
    matchId: "m1",
    courtTitle: "Cincinnati ATP 1000",
    bestOf: 3,
    player1: player("PlayerA"),
    player2: player("PlayerB"),
    ...overrides,
  };
}

const knownSurfaces = new Set(["Cincinnati ATP 1000", "Montreal ATP 1000"]);

describe("filterCandidates", () => {
  it("excludes best-of-1 matches (not '三盘两胜')", () => {
    const result = filterCandidates([match({ bestOf: 1 })], knownSurfaces);
    expect(result).toHaveLength(0);
  });

  it("excludes courts that aren't a real tour skin", () => {
    const result = filterCandidates([match({ courtTitle: "NewLineSynthetic" })], knownSurfaces);
    expect(result).toHaveLength(0);
  });

  it("keeps a best-of-3 match on a known tour court", () => {
    const result = filterCandidates([match({})], knownSurfaces);
    expect(result).toHaveLength(1);
  });

  it("filters a mixed batch down to only the qualifying match", () => {
    const result = filterCandidates(
      [
        match({ bestOf: 1 }),
        match({ courtTitle: "Random Court" }),
        match({ courtTitle: "Montreal ATP 1000" }),
      ],
      knownSurfaces,
    );
    expect(result).toHaveLength(1);
    expect(result[0].courtTitle).toBe("Montreal ATP 1000");
  });
});
