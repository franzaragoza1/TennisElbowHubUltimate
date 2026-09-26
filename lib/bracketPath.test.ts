import { describe, expect, it } from "vitest";
import { isPathConnector, matchIdsInvolving, summarizePath, type PathLayout, type PathPlayer } from "./bracketPath";

const matches = [
  { id: 1, player1Id: 10, player2Id: 11 },
  { id: 2, player1Id: 12, player2Id: 13 },
  { id: 3, player1Id: 10, player2Id: 12 },
  { id: 4, player1Id: -1, player2Id: 14 },
];

describe("matchIdsInvolving", () => {
  it("returns every match the player is in, on either side", () => {
    expect([...matchIdsInvolving(matches, 10)].sort()).toEqual([1, 3]);
    expect([...matchIdsInvolving(matches, 12)].sort()).toEqual([2, 3]);
  });

  it("returns nothing for no selection, byes or TBD placeholders", () => {
    expect(matchIdsInvolving(matches, null).size).toBe(0);
    expect(matchIdsInvolving(matches, -1).size).toBe(0);
    expect(matchIdsInvolving(matches, -2).size).toBe(0);
  });
});

describe("isPathConnector", () => {
  const involved = new Set([1, 3]);

  it("highlights a line only when both its matches are in the path", () => {
    expect(isPathConnector({ fromMatchId: 1, toMatchId: 3 }, involved)).toBe(
      true,
    );
    expect(isPathConnector({ fromMatchId: 2, toMatchId: 3 }, involved)).toBe(
      false,
    );
  });

  it("never highlights a line without match ids", () => {
    expect(isPathConnector({}, involved)).toBe(false);
  });
});

const P = (id: number, name: string): PathPlayer => ({ id, displayName: name, country: null, seed: null });
const NONE = P(-2, "TBD");

interface M {
  id: number;
  round: string;
  p1: PathPlayer;
  p2: PathPlayer;
  winnerId: number | null;
  f1?: number;
  f2?: number;
}

function layoutOf(rounds: string[], ms: M[]): PathLayout {
  const positionById = new Map();
  const matchesByRound = new Map<string, unknown[]>();
  for (const r of rounds) matchesByRound.set(r, []);
  for (const m of ms) {
    const node = {
      match: { id: m.id, round: m.round, player1Id: m.p1.id, player2Id: m.p2.id, winnerId: m.winnerId, player1: m.p1, player2: m.p2 },
      player1FeederId: m.f1 ?? null,
      player2FeederId: m.f2 ?? null,
    };
    positionById.set(m.id, node);
    matchesByRound.get(m.round)!.push(node);
  }
  return { roundOrder: rounds, matchesByRound, positionById } as unknown as PathLayout;
}

const a = P(1, "A");
const b = P(2, "B");
const c = P(3, "C");
const d = P(4, "D");
const e = P(5, "E");
const f = P(6, "F");
const g = P(7, "G");
const h = P(8, "H");

describe("summarizePath", () => {
  it("lists, for each remaining round, only the players still alive on the other side", () => {
    const layout = layoutOf(["Q", "S", "F"], [
      { id: 1, round: "Q", p1: a, p2: b, winnerId: 1 },
      { id: 2, round: "Q", p1: c, p2: d, winnerId: 3 },
      { id: 3, round: "Q", p1: e, p2: f, winnerId: null },
      { id: 4, round: "Q", p1: g, p2: h, winnerId: null },
      { id: 5, round: "S", p1: a, p2: c, winnerId: null, f1: 1, f2: 2 },
      { id: 6, round: "S", p1: NONE, p2: NONE, winnerId: null, f1: 3, f2: 4 },
      { id: 7, round: "F", p1: NONE, p2: NONE, winnerId: null, f1: 5, f2: 6 },
    ]);
    const out = summarizePath(layout, 1);
    if (out?.status !== "alive") throw new Error("expected alive");
    expect(out.rounds.map((r) => r.round)).toEqual(["S", "F"]);
    expect(out.rounds[0].opponents.map((p) => p.displayName)).toEqual(["C"]);
    expect(out.rounds[1].opponents.map((p) => p.displayName).sort()).toEqual(["E", "F", "G", "H"]);
  });

  it("never lists eliminated players, and collapses a decided half to its winner", () => {
    const layout = layoutOf(["Q", "S", "F"], [
      { id: 1, round: "Q", p1: a, p2: b, winnerId: 1 },
      { id: 2, round: "Q", p1: c, p2: d, winnerId: 3 },
      { id: 3, round: "Q", p1: e, p2: f, winnerId: 5 },
      { id: 4, round: "Q", p1: g, p2: h, winnerId: null },
      { id: 5, round: "S", p1: a, p2: c, winnerId: 1, f1: 1, f2: 2 },
      { id: 6, round: "S", p1: e, p2: NONE, winnerId: null, f1: 3, f2: 4 },
      { id: 7, round: "F", p1: a, p2: NONE, winnerId: null, f1: 5, f2: 6 },
    ]);
    const out = summarizePath(layout, 1);
    if (out?.status !== "alive") throw new Error("expected alive");
    expect(out.rounds.map((r) => r.round)).toEqual(["F"]);
    expect(out.rounds[0].opponents.map((p) => p.displayName).sort()).toEqual(["E", "G", "H"]);
  });

  it("reports elimination with the round and who won", () => {
    const layout = layoutOf(["Q", "S", "F"], [
      { id: 1, round: "Q", p1: a, p2: b, winnerId: 1 },
      { id: 5, round: "S", p1: a, p2: c, winnerId: 3, f1: 1 },
    ]);
    expect(summarizePath(layout, 1)).toEqual({ status: "eliminated", round: "S", by: c });
  });

  it("reports the champion, and nothing for a player not in the draw or a placeholder", () => {
    const layout = layoutOf(["S", "F"], [
      { id: 5, round: "S", p1: a, p2: c, winnerId: 1 },
      { id: 7, round: "F", p1: a, p2: e, winnerId: 1, f1: 5 },
    ]);
    expect(summarizePath(layout, 1)).toEqual({ status: "champion" });
    expect(summarizePath(layout, 99)).toBeNull();
    expect(summarizePath(layout, -2)).toBeNull();
    expect(summarizePath(layout, null)).toBeNull();
  });
});
