import { describe, expect, it } from "vitest";
import { parseNewsBody } from "./newsBody";

describe("parseNewsBody", () => {
  it("keeps a normal single-line paragraph as-is", () => {
    expect(parseNewsBody("Hi everyone! A big update is here!")).toEqual([
      { type: "paragraph", lines: ["Hi everyone! A big update is here!"] },
    ]);
  });

  it("splits on blank lines into separate paragraphs", () => {
    expect(parseNewsBody("First paragraph.\n\nSecond paragraph.")).toEqual([
      { type: "paragraph", lines: ["First paragraph."] },
      { type: "paragraph", lines: ["Second paragraph."] },
    ]);
  });

  it("keeps single line breaks within a non-bullet paragraph as separate lines", () => {
    const body = "Line one\nLine two";
    expect(parseNewsBody(body)).toEqual([{ type: "paragraph", lines: ["Line one", "Line two"] }]);
  });

  it("turns a paragraph of all-bullet lines into a real list", () => {
    const body = "- First point\n- Second point\n- Third point";
    expect(parseNewsBody(body)).toEqual([{ type: "list", items: ["First point", "Second point", "Third point"] }]);
  });

  it("treats even a single bullet-prefixed line as a one-item list", () => {
    expect(parseNewsBody("- Just one line")).toEqual([{ type: "list", items: ["Just one line"] }]);
  });

  it("splits a header line from the bullet run that follows it in the same paragraph", () => {
    const body = "New Features :\n- First\n- Second";
    expect(parseNewsBody(body)).toEqual([
      { type: "paragraph", lines: ["New Features :"] },
      { type: "list", items: ["First", "Second"] },
    ]);
  });

  it("reproduces the real patch-notes case (news.id 44) — CRLF, blank-line paragraphs, single-\\n bullet lists", () => {
    const body =
      "Hi everyone! A big update is here!\r\n\r\n" +
      "Gameplay-wise, this update features the biggest change.\r\n" +
      "There are also some restrictions on returns now.\r\n\r\n" +
      "New Features :\r\n" +
      "- Players : 4 new hair styles for the male player.\r\n" +
      "- Modding : you can now remap the Player Styles in the World Tour.";

    expect(parseNewsBody(body)).toEqual([
      { type: "paragraph", lines: ["Hi everyone! A big update is here!"] },
      {
        type: "paragraph",
        lines: [
          "Gameplay-wise, this update features the biggest change.",
          "There are also some restrictions on returns now.",
        ],
      },
      { type: "paragraph", lines: ["New Features :"] },
      {
        type: "list",
        items: ["Players : 4 new hair styles for the male player.", "Modding : you can now remap the Player Styles in the World Tour."],
      },
    ]);
  });
});
