import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLastResultsPage } from "./lastResultsPage";

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf-8");
}

describe("parseLastResultsPage", () => {
  const page = parseLastResultsPage(fixture("last-results.html"));

  it("encuentra resultados reales", () => {
    expect(page.results.length).toBeGreaterThan(50);
  });

  it("arrastra el día hacia abajo entre filas sin celda de fecha propia", () => {
    // Las dos primeras filas reales del fixture son del mismo día (2026-08-12):
    // la primera trae la celda Title, la segunda un <td class="Hidden">.
    expect(page.results[0].reportedAt.startsWith("2026-08-12T22:39:03")).toBe(true);
    expect(page.results[1].reportedAt.startsWith("2026-08-12T22:02:48")).toBe(true);
  });

  it("saca el Trn= del enlace al torneo, sin adivinar por nombre", () => {
    const first = page.results[0];
    expect(first.tournamentExternalId).toBe("2092");
    expect(first.tournamentName).toBe("Cincinnati");
  });

  it("jugadores reales con su externalId de memberlist.php (mismo espacio que OT_Player.php)", () => {
    const first = page.results[0];
    expect(first.winner).toEqual({ externalId: "60940", displayName: "Snoowfy" });
    expect(first.loser).toEqual({ externalId: "61228", displayName: "wukennn" });
  });

  it("parsea el marcador con la misma convención que el cuadro (parseScoreText)", () => {
    const first = page.results[0];
    expect(first.outcome).toBe("played");
    expect(first.sets).toEqual([
      { setNumber: 1, winnerGames: 6, loserGames: 2, tiebreakLoserPoints: null },
      { setNumber: 2, winnerGames: 6, loserGames: 3, tiebreakLoserPoints: null },
    ]);
  });

  it("un walkover no trae sets, pero el reportero puede ser un tercero (no el ganador)", () => {
    const wo = page.results.find((r) => r.outcome === "walkover" && r.winner.displayName === "Dunlop");
    expect(wo).toBeDefined();
    expect(wo!.sets).toEqual([]);
    expect(wo!.reporter?.displayName).toBe("Gyrmik");
    expect(wo!.reporter?.displayName).not.toBe(wo!.winner.displayName);
  });

  it("orden ya viene del más reciente al más antiguo, tal como lo da la fuente", () => {
    const times = page.results.map((r) => new Date(r.reportedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
