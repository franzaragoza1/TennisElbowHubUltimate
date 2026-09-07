import { describe, expect, it } from "vitest";
import { splitLinkifiable } from "./linkify";

describe("splitLinkifiable", () => {
  it("returns a single plain segment when there is no URL", () => {
    expect(splitLinkifiable("No links here.")).toEqual([{ text: "No links here.", href: null }]);
  });

  it("linkifies a bare URL in the middle of a sentence", () => {
    expect(splitLinkifiable("See https://example.com/page for more.")).toEqual([
      { text: "See ", href: null },
      { text: "https://example.com/page", href: "https://example.com/page" },
      { text: " for more.", href: null },
    ]);
  });

  it("strips trailing sentence punctuation from the link", () => {
    expect(splitLinkifiable("Details at https://example.com/x.")).toEqual([
      { text: "Details at ", href: null },
      { text: "https://example.com/x", href: "https://example.com/x" },
      { text: ".", href: null },
    ]);
  });

  it("handles a URL wrapped in parentheses", () => {
    expect(splitLinkifiable("(https://example.com/x)")).toEqual([
      { text: "(", href: null },
      { text: "https://example.com/x", href: "https://example.com/x" },
      { text: ")", href: null },
    ]);
  });

  it("handles multiple URLs in the same text", () => {
    expect(splitLinkifiable("https://a.com and https://b.com")).toEqual([
      { text: "https://a.com", href: "https://a.com" },
      { text: " and ", href: null },
      { text: "https://b.com", href: "https://b.com" },
    ]);
  });
});
