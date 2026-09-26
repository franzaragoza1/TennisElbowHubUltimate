import { describe, expect, it } from "vitest";
import { mergeTargetedRefresh, type FileCounters, type TargetedEntry } from "./targetedRefresh";

const prev: FileCounters = {
  linked: 10,
  skipped: 3,
  errors: [
    'Nadal def. Federer: "Nadal" is not a known tour player (or the name is ambiguous)',
    "Other def. Someone: no matching tour record found",
  ],
  unresolvedNames: ["Nadal", "Zzz"],
};
const approved = new Set(["nadal"]);

describe("mergeTargetedRefresh", () => {
  it("counts a newly linked entry as linked and no longer skipped, and drops its stale error and name", () => {
    const processed: TargetedEntry[] = [{ player1Name: "Nadal", player2Name: "Federer", outcome: { kind: "linked" } }];
    const out = mergeTargetedRefresh(prev, approved, processed);
    expect(out.linked).toBe(11);
    expect(out.skipped).toBe(2);
    expect(out.errors).toEqual(["Other def. Someone: no matching tour record found"]);
    expect(out.unresolvedNames).toEqual(["Zzz"]);
  });

  it("keeps an entry skipped but swaps its error when the name resolves and the match is not found", () => {
    const processed: TargetedEntry[] = [{ player1Name: "Nadal", player2Name: "Federer", outcome: { kind: "unmatched" } }];
    const out = mergeTargetedRefresh(prev, approved, processed);
    expect(out.linked).toBe(10);
    expect(out.skipped).toBe(3);
    expect(out.errors).toContain("Nadal def. Federer: no matching tour record found");
    expect(out.errors.some((e) => e.includes("not a known tour player") && e.startsWith("Nadal def."))).toBe(false);
    expect(out.unresolvedNames).toEqual(["Zzz"]);
  });

  it("reports the other player as unresolved when the approved name resolves but the opponent does not", () => {
    const processed: TargetedEntry[] = [{ player1Name: "Nadal", player2Name: "Foo", outcome: { kind: "unresolved", name: "Foo" } }];
    const out = mergeTargetedRefresh(prev, approved, processed);
    expect(out.linked).toBe(10);
    expect(out.skipped).toBe(3);
    expect(out.unresolvedNames.sort()).toEqual(["Foo", "Zzz"]);
  });

  it("leaves everything alone when no entry was processed", () => {
    expect(mergeTargetedRefresh(prev, new Set(["nobody"]), [])).toEqual(prev);
  });
});
