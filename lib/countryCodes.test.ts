import { describe, expect, it } from "vitest";
import { countryMatchesFilter, getCountryCode, groupCountriesForFilter } from "./countryCodes";

describe("groupCountriesForFilter", () => {
  it("merges every real variant of the same country into one option", () => {
    const options = groupCountriesForFilter(["USA", "U.S.", "United States", "United States of America", "Texas - USA"]);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ value: "US", label: "United States", code: "US" });
  });

  it("merges Russia/Russian Federation and UK/United Kingdom separately", () => {
    const options = groupCountriesForFilter(["Russia", "Russian Federation", "UK", "United Kingdom"]);
    const labels = options.map((o) => o.label).sort();
    expect(labels).toEqual(["Russia", "United Kingdom"]);
  });

  it("keeps an unrecognized country as its own raw-text option instead of dropping or guessing it", () => {
    const options = groupCountriesForFilter(["Narnia"]);
    expect(options).toEqual([{ value: "Narnia", label: "Narnia", code: null }]);
  });

  it("ignores null/empty entries and sorts by label", () => {
    const options = groupCountriesForFilter(["Venezuela", null, "Argentina", ""]);
    expect(options.map((o) => o.label)).toEqual(["Argentina", "Venezuela"]);
  });
});

describe("countryMatchesFilter", () => {
  it("matches a raw country against the ISO-code filter value chosen from a different variant", () => {
    expect(countryMatchesFilter("United States of America", "US")).toBe(true);
    expect(countryMatchesFilter("Spain", "US")).toBe(false);
  });

  it("matches an unrecognized country only by its exact raw text", () => {
    expect(countryMatchesFilter("Narnia", "Narnia")).toBe(true);
    expect(countryMatchesFilter("Narnia", "narnia")).toBe(false);
  });

  it("never matches a null country", () => {
    expect(countryMatchesFilter(null, "US")).toBe(false);
  });
});

describe("getCountryCode sanity (already covered indirectly above, spot-checks only)", () => {
  it("still resolves a plain known name", () => {
    expect(getCountryCode("Spain")).toBe("ES");
  });
});
