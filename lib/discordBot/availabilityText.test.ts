import { describe, expect, it } from "vitest";
import { availabilityBlock, cleanAvailability } from "./availabilityText";

describe("cleanAvailability", () => {
  it("collapses whitespace into one line", () => {
    expect(cleanAvailability("Week Days:  from 17:00\n to 00.00 UTC-4")).toBe("Week Days: from 17:00 to 00.00 UTC-4");
  });

  it("neutralises mentions so the bot's message cannot ping anyone", () => {
    const out = cleanAvailability("@everyone @here <@123> <#456>");
    expect(out).not.toContain("@everyone");
    expect(out).not.toContain("@here");
    expect(out).not.toContain("<@");
    expect(out).not.toContain("<#");
  });

  it("truncates very long text", () => {
    const out = cleanAvailability("a".repeat(500));
    expect(out).toHaveLength(200);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("availabilityBlock", () => {
  it("lists only the players who wrote something", () => {
    const block = availabilityBlock([
      { name: "Ana", availability: "Any day, GMT +8" },
      { name: "Bob", availability: null },
    ]);
    expect(block).toContain("**Ana**: Any day, GMT +8");
    expect(block).not.toContain("Bob");
  });

  it("returns null when nobody has availability, so no empty section is posted", () => {
    expect(availabilityBlock([{ name: "Ana", availability: null }, { name: "Bob", availability: "  " }])).toBeNull();
  });
});
