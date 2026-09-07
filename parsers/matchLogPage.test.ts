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

// El cliente de TE4 escribe la cabecera y la tabla de estadísticas en el idioma que
// tenga configurado quien jugó — verificado contra ficheros reales ya subidos
// (2026-09-07, ver el comentario de SEPARATORS/FRACTION_FIELDS en matchLogPage.ts).
describe("parseMatchLogPage — idiomas distintos al inglés", () => {
  function onlineBlock(header: string, rows: string): string {
    return `<p>${header}</p><table id="1"><tr>${rows}</tr></table>`;
  }

  it('francés: separador " bat. " y las etiquetas reales de la tabla de estadísticas', () => {
    const html = onlineBlock(
      "Gagnant (ELO: 2000 +10 ; Crc = 1) bat. Perdant (ELO: 1500 -10 ; Crc = 2) : 6/3 - Test - 0:10'00 (0:20'00) - 2026-01-01 12:00 [Online]",
      `<td>24 / 43 = 56%</td><td>1er service</td><td>12 / 20 = 60%</td><td>&nbsp;</td>
       <td>2</td><td>Aces</td><td>0</td>
       </tr><tr>
       <td>0</td><td>Doubles Fautes</td><td>1</td><td>&nbsp;</td>
       <td>15</td><td>Points Gagnants</td><td>0</td>`,
    );
    const { page, skipped } = parseMatchLogPage(html);
    expect(skipped).toEqual([]);
    const m = page.entries[0];
    expect(m.player1Name).toBe("Gagnant");
    expect(m.winnerOrderAmbiguous).toBe(false);
    expect(m.player1Stats).toMatchObject({ firstServeIn: 24, firstServeAttempted: 43, aces: 2, doubleFaults: 0, winners: 15 });
    expect(m.player2Stats).toMatchObject({ firstServeIn: 12, firstServeAttempted: 20, aces: 0, doubleFaults: 1, winners: 0 });
  });

  it('polaco: separador " Przegrana " (ganador siempre a la izquierda) y "zak." como retirada', () => {
    const html = onlineBlock(
      "Zwyciezca (ELO: 1800 +5 ; Crc = 1) Przegrana Pokonany (ELO: 1700 -5 ; Crc = 2) : 5/5 zak. - Test - 0:05'00 (0:10'00) - 2026-01-01 12:00 [Online]",
      `<td>0</td><td>Aces</td><td>0</td>`,
    );
    const { page, skipped } = parseMatchLogPage(html);
    expect(skipped).toEqual([]);
    const m = page.entries[0];
    expect(m.player1Name).toBe("Zwyciezca");
    expect(m.player2Name).toBe("Pokonany");
    expect(m.outcome).toBe("retired");
    expect(m.winnerOrderAmbiguous).toBe(false);
    expect(m.sets).toEqual([{ setNumber: 1, winnerGames: 5, loserGames: 5, tiebreakLoserPoints: null }]);
  });

  it('" vs " no garantiza que el ganador vaya primero: se marca winnerOrderAmbiguous', () => {
    const html = onlineBlock(
      "Uno (ELO: 1000 -7 ; Crc = 1) vs Otro (ELO: 900 +7 ; Crc = 2) : 6/4 - Test - 0:05'00 (0:10'00) - 2026-01-01 12:00 [Online]",
      `<td>0</td><td>Aces</td><td>0</td>`,
    );
    const { page, skipped } = parseMatchLogPage(html);
    expect(skipped).toEqual([]);
    const m = page.entries[0];
    expect(m.winnerOrderAmbiguous).toBe(true);
  });

  it("inglés de una build más antigua: '1st Serve'/'Net Approaches'/'Break Point Conversions' (sin '%'/redacción distinta)", () => {
    const html = onlineBlock(
      "A (ELO: 1000 +10 ; Crc = 1) def. B (ELO: 900 -10 ; Crc = 2) : 6/3 - Test - 0:10'00 (0:20'00) - 2026-01-01 12:00 [Online]",
      `<td>7 / 12 = 58%</td><td>1st Serve</td><td>10 / 16 = 63%</td><td>&nbsp;</td>
       <td>1 / 2 = 50%</td><td>Net Approaches</td><td>0 / 1 = 0%</td>
       </tr><tr>
       <td>3 / 6 = 50%</td><td>Break Point Conversions</td><td>0 / 0 = 0%</td>`,
    );
    const { page } = parseMatchLogPage(html);
    const m = page.entries[0];
    expect(m.player1Stats).toMatchObject({
      firstServeIn: 7,
      firstServeAttempted: 12,
      netPointsWon: 1,
      netPointsPlayed: 2,
      breakPointsWon: 3,
      breakPointsFaced: 6,
    });
  });

  it('ruso: separador "победил" (cirílico, ganador siempre a la izquierda) y sus etiquetas reales', () => {
    const html = onlineBlock(
      "Каренин (ELO: 2000 +10 ; Crc = 1) победил Петров (ELO: 1500 -10 ; Crc = 2) : 6/3 - Test - 0:10'00 (0:20'00) - 2026-01-01 12:00 [Online]",
      `<td>62 / 92 = 67%</td><td>1 подача</td><td>81 / 123 = 66%</td><td>&nbsp;</td>
       <td>34</td><td>Эйсы</td><td>0</td>`,
    );
    const { page, skipped } = parseMatchLogPage(html);
    expect(skipped).toEqual([]);
    const m = page.entries[0];
    expect(m.player1Name).toBe("Каренин");
    expect(m.winnerOrderAmbiguous).toBe(false);
    expect(m.player1Stats).toMatchObject({ firstServeIn: 62, firstServeAttempted: 92, aces: 34 });
    expect(m.player2Stats).toMatchObject({ firstServeIn: 81, firstServeAttempted: 123, aces: 0 });
  });

  it("chino simplificado: etiquetas CJK reales, sin separador de palabras entre caracteres", () => {
    const html = onlineBlock(
      "A (ELO: 1000 +10 ; Crc = 1) def. B (ELO: 900 -10 ; Crc = 2) : 6/3 - Test - 0:10'00 (0:20'00) - 2026-01-01 12:00 [Online]",
      `<td>43 / 87 = 49%</td><td>一发进球率</td><td>33 / 86 = 38%</td><td>&nbsp;</td>
       <td>12</td><td>ACES</td><td>1</td>
       </tr><tr>
       <td>93</td><td>总分</td><td>76</td>`,
    );
    const { page } = parseMatchLogPage(html);
    const m = page.entries[0];
    expect(m.player1Stats).toMatchObject({ firstServeIn: 43, firstServeAttempted: 87, aces: 12, totalPointsWon: 93 });
  });

  it('serbocroata: separador " - " suelto no se confunde con el guion de "#rank - Personaje" dentro del propio detalle', () => {
    const html = onlineBlock(
      "A (#105 - Profesionalac-10 90.6%) - B (#137 - Profesionalac-10 100.0%) : 6/3 - Test - 0:10'00 (0:20'00) - 2026-01-01 12:00 [Online]",
      `<td>0</td><td>Aces</td><td>0</td>`,
    );
    const { page, skipped } = parseMatchLogPage(html);
    expect(skipped).toEqual([]);
    const m = page.entries[0];
    expect(m.player1Name).toBe("A");
    expect(m.player2Name).toBe("B");
    expect(m.winnerOrderAmbiguous).toBe(true);
  });
});
