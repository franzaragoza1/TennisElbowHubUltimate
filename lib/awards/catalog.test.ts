import { describe, expect, it } from "vitest";
import { AWARD_CATEGORIES, categoriesForCycle, getAwardCategory, isAwardCategoryKey } from "./catalog";

describe("AWARD_CATEGORIES", () => {
  it("tiene exactamente 10 categorías con claves únicas", () => {
    expect(AWARD_CATEGORIES).toHaveLength(10);
    expect(new Set(AWARD_CATEGORIES.map((c) => c.key)).size).toBe(10);
  });

  it("solo point_of_month exige clip", () => {
    const withClip = AWARD_CATEGORIES.filter((c) => c.requiresClip);
    expect(withClip).toHaveLength(1);
    expect(withClip[0]!.key).toBe("point_of_month");
  });
});

describe("categoriesForCycle", () => {
  it("separa las 3 mensuales de las 7 anuales", () => {
    const monthly = categoriesForCycle("monthly");
    const yearly = categoriesForCycle("yearly");
    expect(monthly).toHaveLength(3);
    expect(yearly).toHaveLength(7);
    expect(monthly.every((c) => c.cycle === "monthly")).toBe(true);
    expect(yearly.every((c) => c.cycle === "yearly")).toBe(true);
  });

  it("mensuales son point/upset/match of the month, en ese orden", () => {
    expect(categoriesForCycle("monthly").map((c) => c.key)).toEqual(["point_of_month", "upset_of_month", "match_of_month"]);
  });
});

describe("getAwardCategory / isAwardCategoryKey", () => {
  it("resuelve una clave real y rechaza una inventada", () => {
    expect(getAwardCategory("match_of_year")?.label).toBe("Match of the Year");
    expect(getAwardCategory("not_a_category")).toBeUndefined();
    expect(isAwardCategoryKey("sportsmanship")).toBe(true);
    expect(isAwardCategoryKey("not_a_category")).toBe(false);
  });
});
