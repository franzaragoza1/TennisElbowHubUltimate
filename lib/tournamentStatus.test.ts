import { describe, expect, it } from "vitest";
import { deriveTournamentStatus } from "./tournamentStatus";

describe("deriveTournamentStatus", () => {
  it("sin cuadro en absoluto: en inscripción", () => {
    expect(deriveTournamentStatus([], false)).toBe("registration");
  });

  it("cuadro recién generado sin ningún partido decidido todavía (solo huecos pending): en juego, no en inscripción", () => {
    // Winston Salem 2026: Main Draw real publicado (cruces tipo "bencu vs Ruze"), pero
    // nada jugado aún — hasDraw viene de matches+byes+pending, no solo de matches.
    expect(deriveTournamentStatus([], true)).toBe("ongoing");
  });

  it("con partidos pero sin ronda F: en juego", () => {
    expect(deriveTournamentStatus([{ round: "R1" }, { round: "Q" }], true)).toBe("ongoing");
  });

  it("con ronda F resuelta: terminado", () => {
    expect(deriveTournamentStatus([{ round: "R1" }, { round: "F" }], true)).toBe("completed");
  });
});
