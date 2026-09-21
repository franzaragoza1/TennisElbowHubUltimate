import { describe, expect, it } from "vitest";
import { probWinGameOnServe, probWinTiebreak, probWinSet, probWinMatch, eloWinProbability, blendHoldRatesWithElo } from "./liveModel";
import { STANDARD_FORMAT, type SetFormat } from "../tennisScore";

const FAST4: SetFormat = { gamesPerSet: 4, setsToWin: 2 };
const BEST_OF_5: SetFormat = { gamesPerSet: 6, setsToWin: 3 };

describe("probWinGameOnServe", () => {
  it("matches the closed-form value (p^4(1+4q+10q^2) + 20p^3q^3 * p^2/(p^2+q^2))", () => {
    expect(probWinGameOnServe(0.6)).toBeCloseTo(0.7357, 3);
    expect(probWinGameOnServe(0.65)).toBeCloseTo(0.8296, 3);
  });

  it("is 0.5 for an even point-win rate", () => {
    expect(probWinGameOnServe(0.5)).toBeCloseTo(0.5, 6);
  });

  it("is monotonically increasing in the point-win rate", () => {
    expect(probWinGameOnServe(0.55)).toBeLessThan(probWinGameOnServe(0.65));
  });
});

describe("probWinTiebreak", () => {
  // Nota: quien saca primero en un tie-break tiene una pequeña ventaja real y conocida
  // (el que empieza sacando puede acabar sirviendo un punto más si el total de puntos
  // es impar) — por eso NO es exactamente 50/50 entre jugadores idénticos, y no debe
  // testearse como si lo fuera. Lo que sí tiene que cumplirse siempre es la simetría:
  // intercambiar quién saca primero intercambia el resultado exactamente.
  it("is symmetric: swapping who serves first flips the probability around 0.5", () => {
    const a = probWinTiebreak(0.65, 0.65, true);
    const b = probWinTiebreak(0.65, 0.65, false);
    expect(a + b).toBeCloseTo(1, 6);
    expect(a).toBeGreaterThan(0.5); // servir primero es una ventaja real, aunque pequeña
  });

  it("favors the stronger server", () => {
    expect(probWinTiebreak(0.7, 0.6, true)).toBeGreaterThan(0.5);
  });
});

describe("probWinSet", () => {
  it("is symmetric from 0-0: swapping who serves first flips the probability around 0.5", () => {
    const a = probWinSet(0, 0, true, 0.65, 0.65, STANDARD_FORMAT);
    const b = probWinSet(0, 0, false, 0.65, 0.65, STANDARD_FORMAT);
    expect(a + b).toBeCloseTo(1, 6);
  });

  it("returns 1/0 once a player has already reached the winning score", () => {
    expect(probWinSet(6, 3, true, 0.6, 0.6, STANDARD_FORMAT)).toBe(1);
    expect(probWinSet(7, 5, true, 0.6, 0.6, STANDARD_FORMAT)).toBe(1);
    expect(probWinSet(3, 6, true, 0.6, 0.6, STANDARD_FORMAT)).toBe(0);
  });

  it("gives the server a large edge from 5-3 serving for the set", () => {
    expect(probWinSet(5, 3, true, 0.65, 0.65, STANDARD_FORMAT)).toBeGreaterThan(0.8);
  });

  it("respects Fast4's first-to-4-no-tiebreak rule: 3-3 is decided by a single game", () => {
    expect(probWinSet(4, 2, true, 0.6, 0.6, FAST4)).toBe(1);
    // A 3-3 en Fast4 no tiene tie-break (ver lib/tennisScore.ts) — el siguiente juego
    // decide el set en seco, así que la probabilidad ES la de ganar ESE juego sacando.
    expect(probWinSet(3, 3, true, 0.65, 0.65, FAST4)).toBeCloseTo(probWinGameOnServe(0.65), 6);
  });
});

describe("probWinMatch", () => {
  it("is roughly symmetric from 0-0 (within the documented 'future sets assume A serves first' simplification)", () => {
    // A diferencia de probWinSet (exactamente simétrico, verificado arriba),
    // probWinMatch asume que CUALQUIER set futuro lo empieza sacando A — una
    // simplificación real y documentada (no hay forma de saber quién sacaría primero
    // un set que no ha empezado), así que aquí la simetría es aproximada, no exacta.
    const a = probWinMatch(0, 0, 0, 0, true, 0.65, 0.65, STANDARD_FORMAT);
    const b = probWinMatch(0, 0, 0, 0, false, 0.65, 0.65, STANDARD_FORMAT);
    expect(a + b).toBeCloseTo(1, 1);
    const a5 = probWinMatch(0, 0, 0, 0, true, 0.65, 0.65, BEST_OF_5);
    const b5 = probWinMatch(0, 0, 0, 0, false, 0.65, 0.65, BEST_OF_5);
    expect(a5 + b5).toBeCloseTo(1, 1);
  });

  it("returns 1/0 once a player has already won enough sets", () => {
    expect(probWinMatch(2, 0, 0, 0, true, 0.5, 0.5, STANDARD_FORMAT)).toBe(1);
    expect(probWinMatch(0, 2, 0, 0, true, 0.5, 0.5, STANDARD_FORMAT)).toBe(0);
  });

  it("heavily favors a player up a set and serving well up in games", () => {
    const p = probWinMatch(1, 0, 4, 1, true, 0.65, 0.65, STANDARD_FORMAT);
    expect(p).toBeGreaterThan(0.9);
  });

  it("a weaker server trailing a set and a break down is a heavy underdog", () => {
    const p = probWinMatch(0, 1, 1, 4, false, 0.55, 0.65, STANDARD_FORMAT);
    expect(p).toBeLessThan(0.15);
  });
});

describe("eloWinProbability", () => {
  it("is exactly 0.5 for equal elo", () => {
    expect(eloWinProbability(1000, 1000)).toBeCloseTo(0.5, 6);
  });

  it("matches the standard 400-point logistic curve (a 400-point gap is a 10:1 favorite)", () => {
    expect(eloWinProbability(1400, 1000)).toBeCloseTo(10 / 11, 3);
  });

  it("is symmetric: swapping the two elos flips the probability around 0.5", () => {
    const a = eloWinProbability(1200, 900);
    const b = eloWinProbability(900, 1200);
    expect(a + b).toBeCloseTo(1, 6);
  });
});

describe("blendHoldRatesWithElo", () => {
  it("returns the original holds unchanged when either player has no elo", () => {
    expect(blendHoldRatesWithElo(0.6, 0.55, null, 1000, STANDARD_FORMAT)).toEqual({ holdA: 0.6, holdB: 0.55 });
    expect(blendHoldRatesWithElo(0.6, 0.55, 1000, null, STANDARD_FORMAT)).toEqual({ holdA: 0.6, holdB: 0.55 });
  });

  it("leaves equal holds roughly unchanged when elo is also equal (nothing to shift towards)", () => {
    // No exactamente 0.6 (misma asimetría "cualquier set futuro lo empieza sacando A"
    // documentada en probWinMatch de arriba: a elo igual, la búsqueda binaria encuentra
    // un delta minúsculo que compensa esa pequeña ventaja de orden de saque) — mismo
    // criterio de tolerancia que "probWinMatch es simétrico solo de forma aproximada".
    const { holdA, holdB } = blendHoldRatesWithElo(0.6, 0.6, 1000, 1000, STANDARD_FORMAT);
    expect(holdA).toBeCloseTo(0.6, 2);
    expect(holdB).toBeCloseTo(0.6, 2);
  });

  it("shifts hold rates toward the elo favorite, heavily (78% weight)", () => {
    // Ambos con el mismo hold "propio" (0.6) pero un salto de elo real — el reparto
    // final tiene que favorecer claramente al de más elo, no quedarse en 0.6/0.6.
    const { holdA, holdB } = blendHoldRatesWithElo(0.6, 0.6, 1300, 900, STANDARD_FORMAT);
    expect(holdA).toBeGreaterThan(0.6);
    expect(holdB).toBeLessThan(0.6);
  });

  it("reproduces roughly the elo-implied match probability at 0-0, not just any shift in the right direction", () => {
    const eloA = 1300;
    const eloB = 900;
    const { holdA, holdB } = blendHoldRatesWithElo(0.6, 0.6, eloA, eloB, STANDARD_FORMAT);
    const impliedProb = probWinMatch(0, 0, 0, 0, true, holdA, holdB, STANDARD_FORMAT);
    // 78% de peso hacia el elo, no el 100% — se espera cerca del valor de elo puro, no
    // exacto (el 22% restante sigue tirando ligeramente hacia el hold propio de 0.6/0.6,
    // que por sí solo daría ~0.5).
    const pureEloTargetOnly = eloWinProbability(eloA, eloB);
    expect(impliedProb).toBeGreaterThan(0.5);
    expect(Math.abs(impliedProb - pureEloTargetOnly)).toBeLessThan(0.15);
  });

  it("still lets a real, decisive lead dominate a merely moderate elo gap the other way", () => {
    // Con un salto de elo MUY extremo (600 puntos, ~3% de probabilidad neutra para A)
    // el modelo arrastra ese peso incluso a un posible tercer set decisivo (donde A
    // seguiría siendo un underdog enorme) — eso NO es un fallo, es la propia
    // composición correcta de probabilidades ("cierra el set actual" + "si no, un
    // tercer set donde el elo pesa mucho"). Aquí se usa un salto más MODERADO (200
    // puntos, ~76% neutro para B) para comprobar el caso que sí se espera dominante:
    // un marcador real ya decisivo (un set arriba y 4-0) tiene que ganarle claramente
    // a un desfavor de elo corriente, no extremo.
    const { holdA, holdB } = blendHoldRatesWithElo(0.6, 0.6, 900, 1100, STANDARD_FORMAT);
    const p = probWinMatch(1, 0, 4, 0, true, holdA, holdB, STANDARD_FORMAT);
    expect(p).toBeGreaterThan(0.9);
  });

  it("lets elo keep real influence even on a big scoreline lead when the elo gap itself is extreme", () => {
    // Mismo marcador que arriba (un set arriba, 4-0), pero con el salto de elo extremo
    // (600 puntos) del resto de este describe — el resultado se queda POR DEBAJO de lo
    // que ese marcador solo daría a elo igual, porque un tercer set decisivo (si B
    // remonta desde 4-0) seguiría siendo un desastre para A a este elo. Confirma que el
    // peso de elo (78%) de verdad se propaga incluso a escenarios futuros del propio
    // partido, no solo al primer set.
    const { holdA, holdB } = blendHoldRatesWithElo(0.6, 0.6, 700, 1300, STANDARD_FORMAT);
    const pWithExtremeEloGap = probWinMatch(1, 0, 4, 0, true, holdA, holdB, STANDARD_FORMAT);
    const pAtEqualElo = probWinMatch(1, 0, 4, 0, true, 0.6, 0.6, STANDARD_FORMAT);
    expect(pWithExtremeEloGap).toBeLessThan(pAtEqualElo);
    expect(pWithExtremeEloGap).toBeGreaterThan(0.5); // el marcador ya jugado sigue pesando, no lo borra del todo
  });
});
