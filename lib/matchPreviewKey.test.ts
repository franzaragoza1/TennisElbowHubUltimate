import { describe, expect, it } from "vitest";
import { parsePreviewKey, previewKey } from "./matchPreviewKey";

describe("previewKey", () => {
  it("is the same whichever side each player is on", () => {
    expect(previewKey("R16", 30, 12)).toBe("R16-12-30");
    expect(previewKey("R16", 12, 30)).toBe("R16-12-30");
  });
});

describe("parsePreviewKey", () => {
  it("reads the stable round-player-player key", () => {
    expect(parsePreviewKey("R16-12-30")).toEqual({ kind: "pair", round: "R16", a: 12, b: 30 });
    expect(parsePreviewKey("Q1-5-9")).toEqual({ kind: "pair", round: "Q1", a: 5, b: 9 });
  });

  it("still reads an old bare slot id", () => {
    expect(parsePreviewKey("4211")).toEqual({ kind: "id", id: 4211 });
  });

  it("round-trips previewKey", () => {
    expect(parsePreviewKey(previewKey("R32", 7, 3))).toEqual({ kind: "pair", round: "R32", a: 3, b: 7 });
  });

  it("rejects anything else", () => {
    expect(parsePreviewKey("abc")).toBeNull();
    expect(parsePreviewKey("R16-12")).toBeNull();
    expect(parsePreviewKey("")).toBeNull();
  });
});
