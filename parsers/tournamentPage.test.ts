import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTournamentPage, parseScoreText } from "./tournamentPage";

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf-8");
}

describe("parseScoreText", () => {
  // Formatos vistos en el backfill completo de 232 torneos, no solo en las fixtures de
  // la fase 1 — "w.o." con y sin punto, en mayúsculas o minúsculas, y "RL" ("Random
  // Luck", jerga de la comunidad TE4 para un cruce que no se llegó a jugar) suman
  // ~880 partidos (~17% del total) que el parser original no reconocía.
  it.each([
    ["w.o.", "walkover"],
    ["WO", "walkover"],
    ["w.o", "walkover"],
    ["DISQ", "disqualified"],
    ["RL", "random"],
  ] as const)('reconoce "%s" como %s', (raw, outcome) => {
    const result = parseScoreText(raw);
    expect(result.outcome).toBe(outcome);
    expect(result.sets).toEqual([]);
  });

  it("un marcador normal sigue siendo 'played'", () => {
    expect(parseScoreText("6/4 6/3").outcome).toBe("played");
  });

  it("una retirada conserva el marcador parcial", () => {
    const result = parseScoreText("5/1 ret.");
    expect(result.outcome).toBe("retired");
    expect(result.sets).toEqual([
      { setNumber: 1, winnerGames: 5, loserGames: 1, tiebreakLoserPoints: null },
    ]);
  });
});

describe("parseTournamentPage", () => {
  it("cuadro de 8 sin R1 (Q,S,F,W)", () => {
    const page = parseTournamentPage(fixture("draw-8.html"), "1825");
    expect(page.edition.drawSize).toBe(8);
    expect(page.edition.competition).toBe("Singles");
    expect(page.edition.queueCount).toBe(7); // 7 inscritos reales -> 1 Bye
    const rounds = new Set(page.matches.map((m) => m.round));
    expect(rounds.has("R1")).toBe(false);
    expect(rounds).toEqual(new Set(["Q", "S", "F"]));
    // Nº de partidos reales = participantes reales - 1 (7 - 1, el Bye no cuenta)
    expect(page.matches).toHaveLength(6);
  });

  it("cuadro de 16 con Bye, DISQ y tie-break (Cincinnati 2021)", () => {
    const page = parseTournamentPage(fixture("draw-16-disq-bye.html"), "1849");
    expect(page.edition.eventName).toBe("Cincinnati");
    expect(page.edition.drawSize).toBe(16);
    expect(page.edition.year).toBe(2021);
    expect(page.edition.isoWeek).toBe(33);
    expect(page.edition.weekStartDate).toBe("2021-08-16");
    expect(page.edition.queueCount).toBe(11);
    expect(page.edition.queueCapacity).toBe(30);
    expect(page.edition.surface).toBe("Blue-Green Cement");
    expect(page.edition.category).toBe("Masters 1000");

    const final = page.matches.find((m) => m.round === "F");
    expect(final).toBeDefined();
    expect(final!.outcome).toBe("played");
    expect(final!.sets).toEqual([
      { setNumber: 1, winnerGames: 6, loserGames: 7, tiebreakLoserPoints: 5 },
      { setNumber: 2, winnerGames: 6, loserGames: 4, tiebreakLoserPoints: null },
      { setNumber: 3, winnerGames: 7, loserGames: 6, tiebreakLoserPoints: 3 },
    ]);
    // JiJo (1) llega a la final (gana la semi 6/0 6/0) pero pierde el título ante Mystery (2)
    const finalists = [final!.player1, final!.player2].map((p) => p.displayName).sort();
    expect(finalists).toEqual(["JiJo", "Mystery"]);
    expect(final!.winnerExternalId).toBe("19048"); // Mystery, campeón

    const disqMatch = page.matches.find((m) => m.outcome === "disqualified");
    expect(disqMatch).toBeDefined();
    expect(disqMatch!.sets).toEqual([]);

    // Ningún partido debería involucrar un hueco (Bye) como jugador real
    const allPlayerIds = page.matches.flatMap((m) => [m.player1.externalId, m.player2.externalId]);
    expect(allPlayerIds.every((id) => id.length > 0)).toBe(true);

    expect(page.roundPoints).toEqual([
      { round: "R1", points: 10 },
      { round: "Q", points: 200 },
      { round: "S", points: 400 },
      { round: "F", points: 650 },
      { round: "W", points: 1000 },
    ]);
  });

  it("cuadro de 32 con walkover y retirada (Perth 2026)", () => {
    const page = parseTournamentPage(fixture("draw-32-wo-ret.html"), "2024");
    expect(page.edition.drawSize).toBe(32);
    expect(page.edition.queueCount).toBe(21);
    expect(page.edition.queueCapacity).toBe(60);

    const woMatch = page.matches.find((m) => m.outcome === "walkover");
    expect(woMatch).toBeDefined();
    expect(["w.o.", "w.o", "wo"]).toContain(woMatch!.scoreRaw?.toLowerCase());
    expect(woMatch!.sets).toEqual([]);

    const retMatch = page.matches.find((m) => m.outcome === "retired");
    expect(retMatch).toBeDefined();
    expect(retMatch!.scoreRaw).toContain("ret.");
    expect(retMatch!.sets.length).toBeGreaterThan(0);
  });

  it("cuadro de 64 partido en dos tablas (Wimbledon 2022)", () => {
    const page = parseTournamentPage(fixture("draw-64-split-tables.html"), "1888");
    expect(page.edition.drawSize).toBe(64);
    expect(page.edition.year).toBe(2022);

    const roundsPresent = new Set(page.matches.map((m) => m.round));
    expect(roundsPresent).toEqual(new Set(["R1", "R2", "R3", "Q", "S", "F"]));

    // Queue=35/120: 35 inscritos reales -> 34 partidos (participantes reales - 1)
    expect(page.edition.queueCount).toBe(35);
    expect(page.matches).toHaveLength(34);

    const final = page.matches.find((m) => m.round === "F");
    expect(final!.winnerExternalId).toBe("10904"); // JiJo campeón
    expect(final!.sets[0]).toEqual({
      setNumber: 1,
      winnerGames: 6,
      loserGames: 3,
      tiebreakLoserPoints: null,
    });

    // La ronda "puente" (R3->Q) debe llevar el marcador real, no vacío
    const r3Match = page.matches.find(
      (m) => m.round === "R3" && [m.player1, m.player2].some((p) => p.externalId === "10904"),
    );
    expect(r3Match!.scoreRaw).toBe("6/0 6/0 6/0");

    // Puntos fusionados de las dos tablas — "Q" aparece en ambas (columna de
    // frontera) con el mismo valor, así que sale una sola vez.
    const pointsByRound = Object.fromEntries(page.roundPoints.map((r) => [r.round, r.points]));
    expect(pointsByRound).toEqual({ R1: 10, R2: 100, R3: 200, Q: 400, S: 800, F: 1300, W: 2000 });
    expect(page.roundPoints).toHaveLength(7);
  });

  it("incluye la sección Qualifications con sus propias rondas", () => {
    const page = parseTournamentPage(fixture("draw-with-qualifying.html"), "1864");
    const qualiRounds = page.matches.filter((m) =>
      ["Q1", "Q2", "Qualified"].includes(m.round),
    );
    expect(qualiRounds.length).toBeGreaterThan(0);
  });

  it("torneo sin Main Draw todavía (en registro) da matches vacío", () => {
    const page = parseTournamentPage(fixture("tournament-not-started.html"), "2095");
    expect(page.edition.drawSize).toBe(128);
    expect(page.matches).toEqual([]);
  });

  it("celda con enlace extra al hilo del reporte no se pierde el jugador (Montreal 2026, Trn=2091)", () => {
    // Algunas celdas de este cuadro traen un <a> extra al hilo del foro con el reporte
    // del partido ("topic_read.png") ANTES del <a> del jugador. Coger el primer <a> a
    // secas cogía ese icono (sin `p=`, sin texto) y la celda se leía como "sin
    // jugador" — el partido entero se perdía en silencio, sin avisar. Confirmado
    // contra el archivo real (backfill del 2026-08-14): el número de partidos subió de
    // 42 a 74 al arreglarlo, y jugadores que llegaron lejos (el campeón, un semifinalista
    // eliminado en octavos) reaparecieron con sus rondas tempranas completas.
    const page = parseTournamentPage(fixture("draw-96-topic-link.html"), "2091");
    expect(page.edition.drawSize).toBe(96);

    const byRound = new Map<string, number>();
    for (const m of page.matches) byRound.set(m.round, (byRound.get(m.round) ?? 0) + 1);
    // Progresión limpia de eliminación directa a partir de R2 (32 -> 16 -> 8 -> 4 -> 2 -> 1);
    // R1 es más bajo porque la mayoría de las 96 plazas entran con bye directo a R2.
    expect(Object.fromEntries(byRound)).toEqual({ R1: 11, R2: 32, R3: 16, R4: 8, Q: 4, S: 2, F: 1 });

    const ryGuyR3 = page.matches.find(
      (m) => m.round === "R3" && [m.player1, m.player2].some((p) => p.displayName === "RyGuy4696"),
    );
    expect(ryGuyR3).toBeDefined();
    expect(ryGuyR3!.scoreRaw).toBe("6/1 6/1");

    // El campeón (Gyrmik) debe tener las 6 rondas completas, no solo las que ya
    // resolvía el árbol desde la Final hacia atrás sin tropezarse con la celda rota.
    const gyrmikRounds = page.matches
      .filter((m) => [m.player1, m.player2].some((p) => p.displayName === "Gyrmik"))
      .map((m) => m.round)
      .sort();
    expect(gyrmikRounds).toEqual(["F", "Q", "R2", "R3", "R4", "S"]);
  });
});
