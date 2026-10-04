import { describe, expect, it } from "vitest";
import { getCategoryRules, normalizeCategoryForDisplay } from "./tournamentCategoryRules";

describe("normalizeCategoryForDisplay", () => {
  it("traduce el prefijo CT al nombre que se enseña", () => {
    expect(normalizeCategoryForDisplay("CT 125")).toBe("Challenger 125");
    expect(normalizeCategoryForDisplay("CT 100")).toBe("Challenger 100");
  });

  it("deja cualquier otra categoría tal cual", () => {
    expect(normalizeCategoryForDisplay("500")).toBe("500");
    expect(normalizeCategoryForDisplay("Grand Slam")).toBe("Grand Slam");
    expect(normalizeCategoryForDisplay("Future")).toBe("Future");
  });
});

describe("getCategoryRules", () => {
  it("Challenger 125 es el escalón más alto, 1550 de límite", () => {
    expect(getCategoryRules("Challenger 125")).toEqual({ eloLimit: 1550, dangerZoneAllowed: true });
  });

  it("acepta el texto crudo de la base de datos ('CT N'), no solo el ya traducido", () => {
    expect(getCategoryRules("CT 125")).toEqual({ eloLimit: 1550, dangerZoneAllowed: true });
    expect(getCategoryRules("CT 100")).toEqual({ eloLimit: 1500, dangerZoneAllowed: true });
  });

  it("cada escalón de Challenger baja 25 respecto al anterior", () => {
    expect(getCategoryRules("Challenger 110")?.eloLimit).toBe(1525);
    expect(getCategoryRules("Challenger 100")?.eloLimit).toBe(1500);
    expect(getCategoryRules("Challenger 90")?.eloLimit).toBe(1475);
    expect(getCategoryRules("Challenger 80")?.eloLimit).toBe(1450);
    expect(getCategoryRules("Challenger 75")?.eloLimit).toBe(1425);
  });

  it("Future tiene su propio límite, no sigue la escalera de Challenger", () => {
    expect(getCategoryRules("Future")).toEqual({ eloLimit: 750, dangerZoneAllowed: true });
  });

  it.each(["Grand Slam", "Masters 1000", "500", "250", "Exhibition", "Other"])(
    "'%s' no tiene reglas propias",
    (category) => {
      expect(getCategoryRules(category)).toBeNull();
    },
  );
});
