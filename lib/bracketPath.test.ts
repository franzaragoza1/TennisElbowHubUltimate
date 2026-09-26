import { describe, expect, it } from "vitest";
import { isPathConnector, matchIdsInvolving } from "./bracketPath";

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
