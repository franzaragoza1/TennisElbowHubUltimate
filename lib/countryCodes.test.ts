import { describe, expect, it } from "vitest";
import { cleanCountryText, countryMatchesFilter, displayCountryName, getCountryCode, groupCountriesForFilter } from "./countryCodes";

// Bytes UTF-8 de una bandera leídos como Latin-1 — como los entrega el ranking.
const FLAG_ES_MOJIBAKE = "ð\u009f\u0087ªð\u009f\u0087¸";
const FLAG_TR_MOJIBAKE = "ð\u009f\u0087¹ð\u009f\u0087·";
const FLAG_SI_MOJIBAKE = "ð\u009f\u0087¸ð\u009f\u0087®";

describe("cleanCountryText", () => {
  it("removes a flag emoji that arrived as mojibake", () => {
    expect(cleanCountryText(`Spain ${FLAG_ES_MOJIBAKE}`)).toBe("Spain");
  });

  it("removes a real flag emoji", () => {
    expect(cleanCountryText("Philippines 🇵🇭")).toBe("Philippines");
  });

  it("repairs accented letters and the flag together", () => {
    expect(cleanCountryText(`TÃ¼rkiye ${FLAG_TR_MOJIBAKE}`)).toBe("Türkiye");
    expect(cleanCountryText("EspaÃ±a")).toBe("España");
  });

  it("keeps the meaning of city/country text", () => {
    expect(cleanCountryText(`Jesenice - Slovenia ${FLAG_SI_MOJIBAKE}`)).toBe("Jesenice - Slovenia");
    expect(cleanCountryText("Córdoba, Argentina")).toBe("Córdoba, Argentina");
  });

  it("returns null for nothing readable", () => {
    expect(cleanCountryText("🇪🇸")).toBeNull();
    expect(cleanCountryText("")).toBeNull();
    expect(cleanCountryText(null)).toBeNull();
  });
});

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

  it("resolves country names written in Greek script, with or without accents", () => {
    expect(getCountryCode("ΕΛΛΑΔΑ")).toBe("GR");
    expect(getCountryCode("Ελλάδα")).toBe("GR");
  });

  it("does not invent a country for a region or empty text", () => {
    expect(getCountryCode("SEA")).toBeNull();
    expect(getCountryCode("")).toBeNull();
  });
});

describe("displayCountryName", () => {
  it("always shows the English name for a recognised country", () => {
    expect(displayCountryName("España")).toBe("Spain");
    expect(displayCountryName("Türkiye")).toBe("Turkey");
    expect(displayCountryName("Italia")).toBe("Italy");
    expect(displayCountryName("ΕΛΛΑΔΑ")).toBe("Greece");
    expect(displayCountryName("Córdoba, Argentina")).toBe("Argentina");
    expect(displayCountryName("Jesenice - Slovenia")).toBe("Slovenia");
  });

  it("strips symbols before deciding", () => {
    expect(displayCountryName("Philippines 🇵🇭")).toBe("Philippines");
  });

  it("falls back to the cleaned text for something unrecognised, and null for nothing", () => {
    expect(displayCountryName("SEA")).toBe("SEA");
    expect(displayCountryName("")).toBeNull();
    expect(displayCountryName(null)).toBeNull();
  });
});
