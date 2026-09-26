import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlayerProfilePage } from "./playerProfilePage";

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf-8");
}

describe("parsePlayerProfilePage", () => {
  it("reads name, id and country", () => {
    expect(parsePlayerProfilePage(fixture("player-profile-city-country.html"))).toEqual({
      externalId: "61488",
      displayName: "Chespi",
      country: "Córdoba, Argentina",
    });
  });

  it("keeps non-Latin country text intact (the ranking delivers it as mojibake)", () => {
    expect(parsePlayerProfilePage(fixture("player-profile-greek.html")).country).toBe("ΕΛΛΑΔΑ");
  });

  it("returns null for an empty Country field instead of failing", () => {
    const page = parsePlayerProfilePage(fixture("player-profile-empty-country.html"));
    expect(page.externalId).toBe("11192");
    expect(page.displayName).toBe("IBM");
    expect(page.country).toBeNull();
  });

  it("returns region-like text as written, without deciding what it means", () => {
    expect(parsePlayerProfilePage(fixture("player-profile-region.html")).country).toBe("SEA");
  });

  it("fails loudly on a page that is not a profile", () => {
    expect(() => parsePlayerProfilePage("<html><body><h2>Something else</h2></body></html>")).toThrow(/Player Details/);
  });

  it("fails loudly when the Country field disappears from the template", () => {
    const broken = fixture("player-profile-empty-country.html").replace(/<dt>Country :[^<]*<\/dt>/, "");
    expect(() => parsePlayerProfilePage(broken)).toThrow(/Country/);
  });
});
