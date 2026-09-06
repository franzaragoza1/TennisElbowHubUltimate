import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMatchLogPage } from "./matchLogPage";

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf-8");
}

describe("parseMatchLogPage", () => {
  const { page, skipped } = parseMatchLogPage(fixture("matchlog-training-club.html"));

  it("solo produce entradas [Online] — descarta partidos offline/contra IA en silencio", () => {
    // El fixture trae 7 bloques: 5 [Online] y 2 offline (uno con "(Incredible-10)" en
    // los dos lados, otro sin paréntesis en ninguno de los dos). Los offline no deben
    // aparecer en `entries` NI en `skipped` (es el caso normal, no un fallo).
    expect(page.entries).toHaveLength(5);
    expect(skipped).toEqual([]);
  });

  it("partido normal: nombres, marcador y estadísticas completas de los dos lados", () => {
    const m = page.entries.find((e) => e.player2Name === "Jira");
    expect(m).toBeDefined();
    expect(m!.player1Name).toBe("Gyrmik");
    expect(m!.outcome).toBe("played");
    expect(m!.sets).toEqual([{ setNumber: 1, winnerGames: 6, loserGames: 3, tiebreakLoserPoints: null }]);
    expect(m!.playedAt.toISOString()).toBe(new Date("2026-05-05T23:50:00").toISOString());

    expect(m!.player1Stats).toMatchObject({
      firstServeIn: 24,
      firstServeAttempted: 43,
      aces: 2,
      doubleFaults: 1,
      fastestServeKmh: 210,
      avgFirstServeSpeedKmh: 190,
      avgSecondServeSpeedKmh: 150,
      winners: 15,
      firstServePointsWon: 16,
      firstServePointsPlayed: 24,
      forcedErrors: 4,
      secondServePointsWon: 10,
      secondServePointsPlayed: 19,
      unforcedErrors: 9,
      returnPointsWon: 11,
      returnPointsPlayed: 20,
      netPointsWon: 1,
      netPointsPlayed: 2,
      breakPointsWon: 2,
      breakPointsFaced: 3,
      totalPointsWon: 37,
    });
    expect(m!.player2Stats).toMatchObject({
      firstServeIn: 12,
      firstServeAttempted: 20,
      aces: 0,
      doubleFaults: 0,
      fastestServeKmh: 203,
      totalPointsWon: 26,
    });
  });

  it("retirada: 'ret.' marca la entrada como retirada y no cuenta como set", () => {
    const m = page.entries.find((e) => e.player2Name === "Donny");
    expect(m).toBeDefined();
    expect(m!.outcome).toBe("retired");
    expect(m!.sets).toEqual([{ setNumber: 1, winnerGames: 5, loserGames: 0, tiebreakLoserPoints: null }]);
  });

  it("tiebreak: el número entre paréntesis es siempre los puntos del perdedor DEL PARTIDO en ese set, nunca del perdedor del set (ver lib/matchScore.ts)", () => {
    const m = page.entries.find((e) => e.player2Name === "[Fake] Jannik Sinner");
    expect(m).toBeDefined();
    expect(m!.sets).toEqual([{ setNumber: 1, winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 3 }]);
  });

  it("un set que pierde el ganador del partido no se reordena: winnerGames/loserGames son SIEMPRE el primer/segundo número del marcador, nunca max/min (bug real: un partido a 4 sets donde el ganador cae 6/7 en el tercero se descartaba entero por no casar con la fila real de `sets`)", () => {
    const m = page.entries.find((e) => e.player1Name === "Madferit");
    expect(m).toBeDefined();
    expect(m!.player2Name).toBe("Gyrmik");
    expect(m!.outcome).toBe("played");
    expect(m!.sets).toEqual([
      { setNumber: 1, winnerGames: 7, loserGames: 5, tiebreakLoserPoints: null },
      { setNumber: 2, winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 8 },
      // El tercer set lo gana Gyrmik (7 games) y lo pierde Madferit (6) — pese a eso,
      // `winnerGames` sigue siendo el número del GANADOR DEL PARTIDO (Madferit, 6),
      // no el más alto de los dos.
      { setNumber: 3, winnerGames: 6, loserGames: 7, tiebreakLoserPoints: 7 },
      { setNumber: 4, winnerGames: 7, loserGames: 5, tiebreakLoserPoints: null },
    ]);
  });

  it("nombres de IA/leyenda ([Fake] ...) se parsean igual — filtrarlos es cosa de lib/matchLog, no del parser", () => {
    const m = page.entries.find((e) => e.player2Name === "[Fake] Jannik Sinner");
    expect(m!.player1Name).toBe("Gyrmik");
  });

  it("normaliza Mph a km/h y no se confunde con un id de tabla negativo", () => {
    const m = page.entries.find((e) => e.player2Name === "zomica");
    expect(m).toBeDefined();
    // 126 Mph -> 202.78 km/h, 132 Mph -> 212.43 km/h, redondeados.
    expect(m!.player1Stats.fastestServeKmh).toBe(203);
    expect(m!.player2Stats.fastestServeKmh).toBe(212);
  });
});
