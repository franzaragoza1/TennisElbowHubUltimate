import { describe, expect, it } from "vitest";
import { stageRound } from "./stageRound";

describe("stageRound", () => {
  it("maps a group-stage match to RR-<group>", () => {
    expect(stageRound({ stage: "group", group: "A" })).toBe("RR-A");
    expect(stageRound({ stage: "group", group: "B" })).toBe("RR-B");
  });

  it("maps a semifinal to S, same vocabulary as a real bracket", () => {
    expect(stageRound({ stage: "semifinal", group: null })).toBe("S");
  });

  it("maps a final to F", () => {
    expect(stageRound({ stage: "final", group: null })).toBe("F");
  });
});
