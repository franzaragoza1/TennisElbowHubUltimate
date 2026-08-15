import { describe, expect, it } from "vitest";
import { pairedScoreFromPerspective, scoreFromPerspective } from "./matchScore";

// Caso real: score_raw "6/7(3) 7/6(4) 7/5" (match_id 54981) — el ganador del partido
// perdió el set 1 en el desempate. winnerGames=6, loserGames=7, tiebreakLoserPoints=3
// para ese set, y el "(3)" va pegado al 7 en la fuente, no al 6.
const SET_LOST_ON_TIEBREAK = { setNumber: 1, winnerGames: 6, loserGames: 7, tiebreakLoserPoints: 3 };
const SET_WON_ON_TIEBREAK = { setNumber: 2, winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 4 };
const SET_NO_TIEBREAK = { setNumber: 3, winnerGames: 7, loserGames: 5, tiebreakLoserPoints: null };

describe("scoreFromPerspective", () => {
  it("el superíndice va con el perdedor del partido, no con quien tuvo menos juegos en ese set", () => {
    const winnerView = scoreFromPerspective([SET_LOST_ON_TIEBREAK], true);
    expect(winnerView).toEqual([{ games: 6, superscript: null }]);

    const loserView = scoreFromPerspective([SET_LOST_ON_TIEBREAK], false);
    expect(loserView).toEqual([{ games: 7, superscript: 3 }]);
  });

  it("cuando el ganador del partido también ganó ese set con desempate, el superíndice sigue en el perdedor", () => {
    const winnerView = scoreFromPerspective([SET_WON_ON_TIEBREAK], true);
    expect(winnerView).toEqual([{ games: 7, superscript: null }]);

    const loserView = scoreFromPerspective([SET_WON_ON_TIEBREAK], false);
    expect(loserView).toEqual([{ games: 6, superscript: 4 }]);
  });

  it("un set sin desempate no lleva superíndice en ningún lado", () => {
    expect(scoreFromPerspective([SET_NO_TIEBREAK], true)).toEqual([{ games: 7, superscript: null }]);
    expect(scoreFromPerspective([SET_NO_TIEBREAK], false)).toEqual([{ games: 5, superscript: null }]);
  });
});

describe("pairedScoreFromPerspective", () => {
  it("da los dos números a la vez, con el superíndice del lado del perdedor del partido", () => {
    expect(pairedScoreFromPerspective([SET_LOST_ON_TIEBREAK], true)).toEqual([
      { playerGames: 6, opponentGames: 7, playerSuperscript: null, opponentSuperscript: 3 },
    ]);
    expect(pairedScoreFromPerspective([SET_LOST_ON_TIEBREAK], false)).toEqual([
      { playerGames: 7, opponentGames: 6, playerSuperscript: 3, opponentSuperscript: null },
    ]);
  });
});
