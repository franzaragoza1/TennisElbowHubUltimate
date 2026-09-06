import { describe, expect, it } from "vitest";
import { formatRemainingTime } from "./formatRemainingTime";

describe("formatRemainingTime", () => {
  const now = new Date("2026-09-05T12:00:00Z");

  it("formats days, hours and minutes remaining", () => {
    expect(formatRemainingTime(new Date("2026-09-07T16:30:00Z"), now)).toBe("2d 4h 30m remaining");
  });

  it("omits days when under 24h but still shows hours", () => {
    expect(formatRemainingTime(new Date("2026-09-05T15:15:00Z"), now)).toBe("3h 15m remaining");
  });

  it("shows just minutes under an hour", () => {
    expect(formatRemainingTime(new Date("2026-09-05T12:20:00Z"), now)).toBe("20m remaining");
  });

  it("marks a past deadline as overdue instead of a bogus 0m remaining", () => {
    expect(formatRemainingTime(new Date("2026-09-05T09:00:00Z"), now)).toBe("Overdue by 3h 0m");
  });

  it("overdue by days", () => {
    expect(formatRemainingTime(new Date("2026-09-02T12:00:00Z"), now)).toBe("Overdue by 3d 0h 0m");
  });
});
