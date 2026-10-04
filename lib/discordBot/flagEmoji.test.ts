import { describe, expect, it } from "vitest";
import { countryCodeToFlagEmoji } from "./flagEmoji";

describe("countryCodeToFlagEmoji", () => {
  it("convierte un código de 2 letras en su bandera Unicode", () => {
    expect(countryCodeToFlagEmoji("ES")).toBe("🇪🇸");
    expect(countryCodeToFlagEmoji("JP")).toBe("🇯🇵");
    expect(countryCodeToFlagEmoji("CN")).toBe("🇨🇳");
  });

  it("es insensible a mayúsculas/minúsculas", () => {
    expect(countryCodeToFlagEmoji("es")).toBe(countryCodeToFlagEmoji("ES"));
  });
});
