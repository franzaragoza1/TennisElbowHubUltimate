import { describe, expect, it } from "vitest";
import { formatFriendlyScore, matchSummary } from "./scoreFormat";

describe("formatFriendlyScore", () => {
  it("sets sin tie-break", () => {
    expect(
      formatFriendlyScore([
        { setNumber: 1, winnerGames: 6, loserGames: 2, tiebreakLoserPoints: null },
        { setNumber: 2, winnerGames: 6, loserGames: 3, tiebreakLoserPoints: null },
      ]),
    ).toBe("6-2, 6-3");
  });

  it("tie-break entre paréntesis, pegado al número del perdedor", () => {
    expect(
      formatFriendlyScore([
        { setNumber: 1, winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 5 },
        { setNumber: 2, winnerGames: 4, loserGames: 6, tiebreakLoserPoints: null },
        { setNumber: 3, winnerGames: 7, loserGames: 5, tiebreakLoserPoints: null },
      ]),
    ).toBe("7-6(5), 4-6, 7-5");
  });
});

describe("matchSummary", () => {
  const sets = [
    { setNumber: 1, winnerGames: 6, loserGames: 2, tiebreakLoserPoints: null },
    { setNumber: 2, winnerGames: 6, loserGames: 3, tiebreakLoserPoints: null },
  ];

  it("partido jugado normal", () => {
    expect(matchSummary("played", "Gyrmik", "Rival", sets)).toBe(
      "Game, set and match Gyrmik. Gyrmik wins the match 6-2, 6-3.",
    );
  });

  it("walkover no inventa marcador", () => {
    expect(matchSummary("walkover", "Gyrmik", "Rival", [])).toBe("Gyrmik advances after a walkover.");
  });

  it("descalificación", () => {
    expect(matchSummary("disqualified", "Gyrmik", "Rival", [])).toBe(
      "Gyrmik advances after Rival was disqualified.",
    );
  });

  it("retirada con marcador parcial", () => {
    const partial = [{ setNumber: 1, winnerGames: 5, loserGames: 1, tiebreakLoserPoints: null }];
    expect(matchSummary("retired", "Gyrmik", "Rival", partial)).toBe(
      "Gyrmik wins after Rival retired, 5-1.",
    );
  });
});
