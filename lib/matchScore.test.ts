import { describe, expect, it } from "vitest";
import { pairedScoreFromPerspective, scoreFromPerspective } from "./matchScore";

// Caso real: score_raw "7/6(5) 6/7(2) 6/2" (match_id 5281, Franky Franchicha def.
// baz0v) — en el set 2 el GANADOR DEL PARTIDO se quedó con 6 juegos y perdió esa
// muerte súbita en concreto (el rival ganó el set 7-6). El "(2)" son los puntos que
// hizo el perdedor DE ESE DESEMPATE, y el perdedor de ese desempate es quien se quedó
// con el número más bajo de los dos (6, el del ganador del partido) — no "siempre el
// perdedor del partido" (bug real reportado y corregido, 2026-09-07: la tarjeta
// pegaba el "(2)" al lado de baz0v en vez de al del propio ganador del partido).
const SET_MATCH_WINNER_LOST_THIS_SET = { setNumber: 2, winnerGames: 6, loserGames: 7, tiebreakLoserPoints: 2 };
// Set 1 del mismo partido: el ganador del partido también ganó este set con
// desempate (7-6), así que aquí SÍ coincide "perdedor del set" con "perdedor del
// partido" — el caso donde el atajo antiguo daba la respuesta correcta por casualidad.
const SET_MATCH_WINNER_WON_THIS_SET = { setNumber: 1, winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 5 };
const SET_NO_TIEBREAK = { setNumber: 3, winnerGames: 6, loserGames: 2, tiebreakLoserPoints: null };

describe("scoreFromPerspective", () => {
  it("el superíndice va con quien perdió ESE set, aunque sea el ganador del partido", () => {
    const winnerView = scoreFromPerspective([SET_MATCH_WINNER_LOST_THIS_SET], true);
    expect(winnerView).toEqual([{ games: 6, superscript: 2 }]);

    const loserView = scoreFromPerspective([SET_MATCH_WINNER_LOST_THIS_SET], false);
    expect(loserView).toEqual([{ games: 7, superscript: null }]);
  });

  it("cuando el ganador del partido también ganó ese set con desempate, el superíndice cae en el rival (que sí perdió ese set)", () => {
    const winnerView = scoreFromPerspective([SET_MATCH_WINNER_WON_THIS_SET], true);
    expect(winnerView).toEqual([{ games: 7, superscript: null }]);

    const loserView = scoreFromPerspective([SET_MATCH_WINNER_WON_THIS_SET], false);
    expect(loserView).toEqual([{ games: 6, superscript: 5 }]);
  });

  it("un set sin desempate no lleva superíndice en ningún lado", () => {
    expect(scoreFromPerspective([SET_NO_TIEBREAK], true)).toEqual([{ games: 6, superscript: null }]);
    expect(scoreFromPerspective([SET_NO_TIEBREAK], false)).toEqual([{ games: 2, superscript: null }]);
  });
});

describe("pairedScoreFromPerspective", () => {
  it("da los dos números a la vez, con el superíndice del lado que perdió ESE set", () => {
    expect(pairedScoreFromPerspective([SET_MATCH_WINNER_LOST_THIS_SET], true)).toEqual([
      { playerGames: 6, opponentGames: 7, playerSuperscript: 2, opponentSuperscript: null },
    ]);
    expect(pairedScoreFromPerspective([SET_MATCH_WINNER_LOST_THIS_SET], false)).toEqual([
      { playerGames: 7, opponentGames: 6, playerSuperscript: null, opponentSuperscript: 2 },
    ]);
  });
});
