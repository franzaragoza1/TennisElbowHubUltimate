import { describe, expect, it } from "vitest";
import { isWithinRollingWindow, rollingWindowStart } from "./rollingWindow";

describe("rollingWindowStart", () => {
  it("364 días (52 semanas) antes de `asOf`, en milisegundos puros", () => {
    const asOf = new Date("2026-01-01T00:00:00Z");
    expect(rollingWindowStart(asOf)).toEqual(new Date("2025-01-02T00:00:00Z"));
  });

  it("52 semanas exactas -> mismo día de la semana que `asOf`, incluso cruzando un año bisiesto (2024)", () => {
    const asOf = new Date("2025-03-01T00:00:00Z");
    const start = rollingWindowStart(asOf);
    expect(start.getUTCDay()).toBe(asOf.getUTCDay());
  });
});

describe("isWithinRollingWindow", () => {
  const asOf = new Date("2026-01-01T00:00:00Z");
  const start = rollingWindowStart(asOf); // 2025-01-02T00:00:00Z

  it("justo en el borde de inicio (inclusive)", () => {
    expect(isWithinRollingWindow(start, asOf)).toBe(true);
  });

  it("un día antes del borde de inicio: fuera", () => {
    expect(isWithinRollingWindow(new Date("2025-01-01T00:00:00Z"), asOf)).toBe(false);
  });

  it("justo en `asOf` (inclusive)", () => {
    expect(isWithinRollingWindow(asOf, asOf)).toBe(true);
  });

  it("un día después de `asOf`: fuera (no cuentan semanas futuras)", () => {
    expect(isWithinRollingWindow(new Date("2026-01-02T00:00:00Z"), asOf)).toBe(false);
  });

  it("bien dentro de la ventana", () => {
    expect(isWithinRollingWindow(new Date("2025-06-15T00:00:00Z"), asOf)).toBe(true);
  });
});
