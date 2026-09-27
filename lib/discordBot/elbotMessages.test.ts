import { describe, expect, it } from "vitest";
import { parseElbotMessage, waitingEntryMatchesShortName } from "./elbotMessages";

// Todos los mensajes de este fichero son capturas REALES del canal de elbot
// (2026-09-24), no inventados — ver el comentario de elbotMessages.ts.

describe("parseElbotMessage — 'wants to play' announcements", () => {
  it("parses a real announcement with all fields, including a bracketed comment suffix", () => {
    const result = parseElbotMessage(
      "**nole o.5** (elo: `1127`, rep: `43%`) wants to play a `1-set` match (using `No preview` / `Simulation` / `Realistic`) Comment: XKT v4.4c [3games 10pt TB]",
    );
    expect(result).toEqual({
      type: "waiting",
      displayName: "nole o.5",
      elo: 1127,
      rep: 43,
      sets: 1,
      preview: "No preview",
      difficulty: "Simulation",
      mode: "Realistic",
      comment: "XKT v4.4c [3games 10pt TB]",
    });
  });

  it("parses a negative rep percentage correctly, not as a parse failure", () => {
    const result = parseElbotMessage(
      "**Conan-Dada8** (elo: `791`, rep: `-42%`) wants to play a `1-set` match (using `No preview` / `Simulation` / `Fair`) Comment: XKT v4.4b",
    );
    expect(result).toMatchObject({ type: "waiting", displayName: "Conan-Dada8", rep: -42 });
  });

  it("parses a 2-set match and a name containing brackets", () => {
    const result = parseElbotMessage(
      "**[Fake] Holger Rune** (elo: `760`, rep: `21%`) wants to play a `1-set` match (using `Service + Rally` / `Simulation` / `Realistic`) Comment: XKT v4.4b",
    );
    expect(result).toMatchObject({ type: "waiting", displayName: "[Fake] Holger Rune", sets: 1 });

    const twoSet = parseElbotMessage(
      "**DinnoMm** (elo: `408`, rep: `23%`) wants to play a `2-set` match (using `No preview` / `Simulation` / `Free`) Comment: ATP - XKT(WTSL) v4.4g",
    );
    expect(twoSet).toMatchObject({ type: "waiting", sets: 2, comment: "ATP - XKT(WTSL) v4.4g" });
  });
});

describe("parseElbotMessage — 'started a game' events", () => {
  it("parses a real started-game message with the leading spacer block", () => {
    const result = parseElbotMessage("`            `_Jele started a game with 丑抠._");
    expect(result).toEqual({ type: "started", player1Short: "Jele", player2Short: "丑抠" });
  });

  it("parses one with a bracketed abbreviated name on the opponent side", () => {
    const result = parseElbotMessage("`            `_jordtot started a game with [.Rune._");
    expect(result).toEqual({ type: "started", player1Short: "jordtot", player2Short: "[.Rune" });
  });

  it("still parses correctly without the leading spacer block, in case elbot ever omits it", () => {
    const result = parseElbotMessage("_R.Coldsteel started a game with ComeDippers._");
    expect(result).toEqual({ type: "started", player1Short: "R.Coldsteel", player2Short: "ComeDippers" });
  });
});

describe("parseElbotMessage — final score (any flavor-text verb phrase)", () => {
  it("parses real examples, whatever the narrative verb phrase is", () => {
    expect(parseElbotMessage("`            `_[.Davenport struggled valiantly and wore down Jele. Final score: 7-6._")).toEqual({
      type: "finished",
      winnerShort: "[.Davenport",
      loserShort: "Jele",
      score: "7-6",
    });
    expect(parseElbotMessage("`            `_mareasdf dominated Nick1234567. Final score: 6-0 6-2._")).toEqual({
      type: "finished",
      winnerShort: "mareasdf",
      loserShort: "Nick1234567",
      score: "6-0 6-2",
    });
    expect(parseElbotMessage("`            `_robinm20 fumbled his way to a victory over Noah. Final score: 6-0._")).toEqual({
      type: "finished",
      winnerShort: "robinm20",
      loserShort: "Noah",
      score: "6-0",
    });
  });

  it("handles a winner name with an internal period, real example", () => {
    expect(parseElbotMessage("`            `_F.Auger-Aliassi. thrashed G.Schwing. Final score: 6-4._")).toEqual({
      type: "finished",
      winnerShort: "F.Auger-Aliassi.",
      loserShort: "G.Schwing",
      score: "6-4",
    });
  });

  it("handles a best-of-three score with three sets, real example", () => {
    expect(parseElbotMessage("`            `_X3NOX_BoB obliterated ChoLaFree. Final score: 6-7 6-0 6-2._")).toEqual({
      type: "finished",
      winnerShort: "X3NOX_BoB",
      loserShort: "ChoLaFree",
      score: "6-7 6-0 6-2",
    });
  });

  it("works without the leading spacer block too", () => {
    expect(parseElbotMessage("_Oz managed to win against Hash. Final score: 6-2._")).toEqual({
      type: "finished",
      winnerShort: "Oz",
      loserShort: "Hash",
      score: "6-2",
    });
  });
});

describe("parseElbotMessage — everything else is ignored, never guessed at", () => {
  it("returns null for a real broken/stray message seen in production (bare Comment, nothing else)", () => {
    expect(parseElbotMessage("Comment: XKT v4.4b")).toBeNull();
  });

  it("returns null for empty or unrelated content", () => {
    expect(parseElbotMessage("")).toBeNull();
    expect(parseElbotMessage("hey does anyone want to play")).toBeNull();
  });
});

describe("waitingEntryMatchesShortName", () => {
  it("matches every real abbreviation pattern observed (first-initial + last word)", () => {
    expect(waitingEntryMatchesShortName("Rean Coldsteel", "R.Coldsteel")).toBe(true);
    expect(waitingEntryMatchesShortName("Yari Zornia", "Y.Zornia")).toBe(true);
    expect(waitingEntryMatchesShortName("[Fake] Holger Rune", "[.Rune")).toBe(true);
    expect(waitingEntryMatchesShortName("[Fake] Carlos Alcaraz", "[.Alcaraz")).toBe(true);
  });

  it("matches single-word names left unabbreviated, case-insensitively", () => {
    expect(waitingEntryMatchesShortName("Giuseppe", "Giuseppe")).toBe(true);
    expect(waitingEntryMatchesShortName("jele", "Jele")).toBe(true);
    expect(waitingEntryMatchesShortName("丑抠", "丑抠")).toBe(true);
  });

  it("does not match an unrelated player", () => {
    expect(waitingEntryMatchesShortName("Rean Coldsteel", "ComeDippers")).toBe(false);
    expect(waitingEntryMatchesShortName("Giuseppe", "R.Coldsteel")).toBe(false);
  });

  it("does not false-positive on a short name that merely contains the last word as a substring, not a suffix", () => {
    // "Coldsteelian" contiene "Coldsteel" pero no TERMINA con él — no debería colar.
    expect(waitingEntryMatchesShortName("Rean Coldsteel", "Coldsteelian")).toBe(false);
  });
});
