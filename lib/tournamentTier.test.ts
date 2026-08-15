import { describe, expect, it } from "vitest";
import { TIER_WEIGHT, tournamentTier } from "./tournamentTier";

describe("tournamentTier", () => {
  it("Grand Slam es 'large'", () => {
    expect(tournamentTier("Grand Slam")).toBe("large");
  });

  it("Masters 1000 es 'medium-large'", () => {
    expect(tournamentTier("Masters 1000")).toBe("medium-large");
  });

  it("500 y 250 son 'medium'", () => {
    expect(tournamentTier("500")).toBe("medium");
    expect(tournamentTier("250")).toBe("medium");
  });

  it("los Challenger Tour y Future son 'small'", () => {
    expect(tournamentTier("CT 125")).toBe("small");
    expect(tournamentTier("CT 100")).toBe("small");
    expect(tournamentTier("CT 90")).toBe("small");
    expect(tournamentTier("CT 80")).toBe("small");
    expect(tournamentTier("Future")).toBe("small");
  });

  it("una categoría desconocida cae en 'small', nunca revienta", () => {
    expect(tournamentTier("Exhibition")).toBe("small");
    expect(tournamentTier("")).toBe("small");
  });

  it("TIER_WEIGHT ordena de menor a mayor peso, en el mismo orden que las categorías reales", () => {
    const categories = ["Grand Slam", "CT 100", "Masters 1000", "250", "Future", "500"];
    const sorted = [...categories].sort((a, b) => TIER_WEIGHT[tournamentTier(a)] - TIER_WEIGHT[tournamentTier(b)]);
    const tiers = sorted.map(tournamentTier);
    expect(tiers).toEqual(["small", "small", "medium", "medium", "medium-large", "large"]);
  });
});
