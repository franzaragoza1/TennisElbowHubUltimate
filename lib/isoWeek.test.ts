import { describe, expect, it } from "vitest";
import { getIsoWeek } from "./isoWeek";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("getIsoWeek", () => {
  // Regla del propio estándar ISO 8601, no un dato memorizado: la semana 1 es SIEMPRE
  // la que contiene el 4 de enero — así que esto vale sin importar qué día de la
  // semana caiga el 4 de enero ese año.
  it.each([2000, 2020, 2024, 2025, 2026])("4 de enero de %i siempre cae en la semana 1 de ese año", (year) => {
    expect(getIsoWeek(new Date(Date.UTC(year, 0, 4)))).toEqual({ isoYear: year, isoWeek: 1 });
  });

  // Misma idea al otro extremo: el 28 de diciembre SIEMPRE cae en la última semana
  // de SU PROPIO año (nunca se desliza al año ISO siguiente).
  it.each([2000, 2020, 2024, 2025, 2026])("28 de diciembre de %i siempre cae en la última semana de ese mismo año", (year) => {
    expect(getIsoWeek(new Date(Date.UTC(year, 11, 28))).isoYear).toBe(year);
  });

  it("sumar 7 días siempre avanza exactamente una semana ISO (dentro del mismo año)", () => {
    const a = getIsoWeek(new Date(Date.UTC(2026, 6, 15)));
    const b = getIsoWeek(new Date(Date.UTC(2026, 6, 15 + 7)));
    expect(b).toEqual({ isoYear: a.isoYear, isoWeek: a.isoWeek + 1 });
  });

  // Derivado, no memorizado: el 4 de enero es semana 1 por definición; el lunes que
  // empieza esa semana se calcula con aritmética simple (no con isoWeek.ts); el
  // domingo justo antes de ese lunes tiene que pertenecer, por definición, al año
  // ISO anterior (las semanas ISO son contiguas, sin huecos).
  it("el día justo antes del lunes de la semana 1 pertenece al año ISO anterior", () => {
    const year = 2026;
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const mondayOffset = (jan4.getUTCDay() + 6) % 7; // lunes=0 .. domingo=6
    const week1Monday = new Date(jan4.getTime() - mondayOffset * DAY_MS);
    const dayBefore = new Date(week1Monday.getTime() - DAY_MS);
    expect(getIsoWeek(dayBefore).isoYear).toBe(year - 1);
  });
});
