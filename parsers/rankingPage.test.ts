import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseRankingPage } from "./rankingPage";

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf-8");
}

describe("parseRankingPage", () => {
  it("parsea la semana actual (2026-32)", () => {
    const page = parseRankingPage(fixture("ranking-current.html"));
    expect(page.isoYear).toBe(2026);
    expect(page.isoWeek).toBe(32);
    expect(page.rows).toHaveLength(273);

    const first = page.rows[0];
    expect(first).toEqual({
      rank: 1,
      moved: 0,
      player: { externalId: "48100", displayName: "Jirafalox" },
      country: "Chile",
      points: 13410,
      smallTrn: 4,
    });

    const last = page.rows.at(-1)!;
    expect(last.rank).toBe(273);
    expect(last.player.displayName).toBe("Santanaraptor");
  });

  it("parsea +N / -N en la columna Moved", () => {
    const page = parseRankingPage(fixture("ranking-current.html"));
    const moved = page.rows.map((r) => r.moved);
    expect(moved).toContain(1);
    expect(moved).toContain(-1);
    expect(moved).toContain(7);
  });

  it("parsea una semana antigua (2011-26) con el mismo esquema", () => {
    const page = parseRankingPage(fixture("ranking-old-week.html"));
    expect(page.isoYear).toBe(2011);
    expect(page.isoWeek).toBe(26);
    expect(page.rows.length).toBeGreaterThan(0);
  });
});
