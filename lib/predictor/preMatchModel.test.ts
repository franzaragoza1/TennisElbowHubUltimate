import { describe, expect, it } from "vitest";
import { computeWinProbability, type PreMatchFactors } from "./preMatchModel";

const NEUTRAL: PreMatchFactors = { rankingGapScore: 0, h2hScore: 0, recentFormScore: 0, surfaceScore: 0 };

describe("computeWinProbability", () => {
  it("is an exact 50/50 when every factor is neutral", () => {
    const { player1, player2 } = computeWinProbability(NEUTRAL);
    expect(player1).toBeCloseTo(0.5, 10);
    expect(player2).toBeCloseTo(0.5, 10);
  });

  it("always sums to 1", () => {
    const { player1, player2 } = computeWinProbability({ rankingGapScore: 0.4, h2hScore: -0.2, recentFormScore: 0.1, surfaceScore: 0.3 });
    expect(player1 + player2).toBeCloseTo(1, 10);
  });

  it("favors player1 when every factor favors player1", () => {
    const { player1 } = computeWinProbability({ rankingGapScore: 0.6, h2hScore: 0.5, recentFormScore: 0.3, surfaceScore: 0.2 });
    expect(player1).toBeGreaterThan(0.5);
  });

  it("weighs the ranking gap far more heavily than a small H2H sample", () => {
    // Un rival muy superior en ranking pero perdiendo el H2H 1-0 sigue siendo favorito
    // — el peso de ranking (0.5) domina sobre un h2hScore todavía pequeño.
    const rankingDominant = computeWinProbability({ rankingGapScore: 0.9, h2hScore: -0.3, recentFormScore: 0, surfaceScore: 0 });
    expect(rankingDominant.player1).toBeGreaterThan(0.5);
  });

  it("is symmetric: swapping every factor's sign swaps the probabilities", () => {
    const factors: PreMatchFactors = { rankingGapScore: 0.4, h2hScore: -0.1, recentFormScore: 0.2, surfaceScore: -0.05 };
    const flipped: PreMatchFactors = {
      rankingGapScore: -factors.rankingGapScore,
      h2hScore: -factors.h2hScore,
      recentFormScore: -factors.recentFormScore,
      surfaceScore: -factors.surfaceScore,
    };
    const a = computeWinProbability(factors);
    const b = computeWinProbability(flipped);
    expect(a.player1).toBeCloseTo(b.player2, 10);
  });

  it("reaches a clearly one-sided probability for a maximally lopsided matchup", () => {
    const { player1 } = computeWinProbability({ rankingGapScore: 1, h2hScore: 1, recentFormScore: 1, surfaceScore: 1 });
    expect(player1).toBeGreaterThan(0.85);
  });
});
