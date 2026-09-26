import { describe, expect, it } from "vitest";
import { formatDeadlineUtc } from "./deadlineText";

describe("formatDeadlineUtc", () => {
  it("writes the deadline in UTC, whatever the server's timezone", () => {
    const out = formatDeadlineUtc(new Date("2026-09-21T16:13:00Z"));
    expect(out.startsWith("Mon, 21 Sep 2026, 16:13 UTC")).toBe(true);
  });

  it("pads hours and minutes", () => {
    expect(formatDeadlineUtc(new Date("2026-01-05T04:05:00Z")).startsWith("Mon, 5 Jan 2026, 04:05 UTC")).toBe(true);
  });

  it("adds a relative timestamp that does not depend on anyone's timezone", () => {
    const d = new Date("2026-09-21T16:13:00Z");
    expect(formatDeadlineUtc(d)).toContain(`<t:${d.getTime() / 1000}:R>`);
  });
});
