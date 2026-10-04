import { describe, expect, it } from "vitest";
import { calculateSchedule } from "./tournamentScheduleMath";

describe("calculateSchedule", () => {
  it("empieza el sábado anterior al lunes ISO, cierra inscripción el viernes de antes", () => {
    // ISO week 40 de 2026 empieza el lunes 28 de septiembre de 2026.
    const { startDate, queueUntil } = calculateSchedule(40, 2026);
    expect(startDate).toBe("Saturday, September 26th");
    expect(queueUntil).toBe("Friday, September 25th");
  });

  it("cruza de mes correctamente", () => {
    // ISO week 1 de 2027 empieza el lunes 4 de enero de 2027.
    const { startDate, queueUntil } = calculateSchedule(1, 2027);
    expect(startDate).toBe("Saturday, January 2nd");
    expect(queueUntil).toBe("Friday, January 1st");
  });
});
