import { describe, expect, it } from "vitest";
import { buildBracketLayout, fullRoundLadder, roundDisplayLabel, type BracketMatchInput } from "./bracket";

/**
 * Datos reales de Perth 2026 (Trn=2024, editionId=176, cuadro de 32), verificados a
 * mano contra la base de datos antes de escribir el algoritmo — ver plan de la fase
 * "cuadro de torneo". Nombres en comentario, solo hacen falta los ids para el test.
 */
// 1 lord goatic · 2 hrvoje996 · 3 J.I · 4 jus · 5 CaptainCrazy · 6 Deatekk
// 7 GregoryDuViveiro · 8 Shomyleee · 9 ToeKnee · 10 Fadvna · 11 Tomico · 12 yasmin
// 13 federaz · 14 bencu · 15 Psyroroo · 16 Pecajordan · 17 HSM88 · 18 Nazhouh
// 19 Donny · 20 DinnoMm · 21 Ericpova
// Id de relleno para el lado "Bye" de una tarjeta sintética — no es un jugador real,
// solo hace falta que no coincida con ningún id de la lista de arriba (mismo patrón
// que usa más abajo el describe de "alineación por promedio").
const R1_BYE = 999;

const PERTH_2026: BracketMatchInput[] = [
  // R1 — reconstruido contra el HTML archivado real (Trn=2024): 16 huecos en total
  // (5 partidos + 11 byes), exactamente el doble de los 8 de R2 — así es como sale de
  // verdad un cuadro de 32 con byes, no los 5 partidos sueltos que tenía este fixture
  // antes de que el parser capturase byes reales (ver docs/decisiones.md).
  { id: 101, round: "R1", player1Id: 11, player2Id: R1_BYE, winnerId: 11, sortIndex: 0 }, // Tomico, bye
  { id: 102, round: "R1", player1Id: 1, player2Id: 2, winnerId: 1, sortIndex: 1 },
  { id: 103, round: "R1", player1Id: 12, player2Id: R1_BYE, winnerId: 12, sortIndex: 2 }, // yasmin, bye
  { id: 104, round: "R1", player1Id: 13, player2Id: R1_BYE, winnerId: 13, sortIndex: 3 }, // federaz, bye
  { id: 105, round: "R1", player1Id: 14, player2Id: R1_BYE, winnerId: 14, sortIndex: 4 }, // bencu, bye
  { id: 106, round: "R1", player1Id: 3, player2Id: 4, winnerId: 3, sortIndex: 5 },
  { id: 107, round: "R1", player1Id: 5, player2Id: 6, winnerId: 6, sortIndex: 6 },
  { id: 108, round: "R1", player1Id: 15, player2Id: R1_BYE, winnerId: 15, sortIndex: 7 }, // Psyroroo, bye
  { id: 109, round: "R1", player1Id: 16, player2Id: R1_BYE, winnerId: 16, sortIndex: 8 }, // Pecajordan, bye
  { id: 110, round: "R1", player1Id: 7, player2Id: 8, winnerId: 8, sortIndex: 9 },
  { id: 111, round: "R1", player1Id: 17, player2Id: R1_BYE, winnerId: 17, sortIndex: 10 }, // HSM88, bye
  { id: 112, round: "R1", player1Id: 18, player2Id: R1_BYE, winnerId: 18, sortIndex: 11 }, // Nazhouh, bye
  { id: 113, round: "R1", player1Id: 19, player2Id: R1_BYE, winnerId: 19, sortIndex: 12 }, // Donny, bye
  { id: 114, round: "R1", player1Id: 20, player2Id: R1_BYE, winnerId: 20, sortIndex: 13 }, // DinnoMm, bye
  { id: 115, round: "R1", player1Id: 9, player2Id: 10, winnerId: 10, sortIndex: 14 },
  { id: 116, round: "R1", player1Id: 21, player2Id: R1_BYE, winnerId: 21, sortIndex: 15 }, // Ericpova, bye
  // R2
  { id: 201, round: "R2", player1Id: 11, player2Id: 1, winnerId: 1, sortIndex: 0 },
  { id: 202, round: "R2", player1Id: 12, player2Id: 13, winnerId: 12, sortIndex: 1 },
  { id: 203, round: "R2", player1Id: 14, player2Id: 3, winnerId: 14, sortIndex: 2 },
  { id: 204, round: "R2", player1Id: 6, player2Id: 15, winnerId: 6, sortIndex: 3 },
  { id: 205, round: "R2", player1Id: 16, player2Id: 8, winnerId: 8, sortIndex: 4 },
  { id: 206, round: "R2", player1Id: 17, player2Id: 18, winnerId: 18, sortIndex: 5 },
  { id: 207, round: "R2", player1Id: 19, player2Id: 20, winnerId: 19, sortIndex: 6 },
  { id: 208, round: "R2", player1Id: 10, player2Id: 21, winnerId: 10, sortIndex: 7 },
  // Cuartos
  { id: 301, round: "Q", player1Id: 1, player2Id: 12, winnerId: 1, sortIndex: 0 },
  { id: 302, round: "Q", player1Id: 14, player2Id: 6, winnerId: 14, sortIndex: 1 },
  { id: 303, round: "Q", player1Id: 8, player2Id: 18, winnerId: 8, sortIndex: 2 },
  { id: 304, round: "Q", player1Id: 19, player2Id: 10, winnerId: 10, sortIndex: 3 },
  // Semis
  { id: 401, round: "S", player1Id: 1, player2Id: 14, winnerId: 1, sortIndex: 0 },
  { id: 402, round: "S", player1Id: 8, player2Id: 10, winnerId: 8, sortIndex: 1 },
  // Final
  { id: 501, round: "F", player1Id: 1, player2Id: 8, winnerId: 8, sortIndex: 0 },
];

describe("buildBracketLayout", () => {
  it("ordena las rondas presentes de más temprana a Final", () => {
    const { roundOrder } = buildBracketLayout(PERTH_2026);
    expect(roundOrder).toEqual(["R1", "R2", "Q", "S", "F"]);
  });

  it("encadena la Final con sus dos partidos de Semis", () => {
    const { positionById } = buildBracketLayout(PERTH_2026);
    const final = positionById.get(501)!;
    expect(final.player1FeederId).toBe(401); // lord goatic viene de la semi 401
    expect(final.player2FeederId).toBe(402); // Shomyleee viene de la semi 402
  });

  it("encadena la cadena completa de lord goatic hasta R1 (F<-S<-Q<-R2<-R1)", () => {
    const { positionById } = buildBracketLayout(PERTH_2026);
    expect(positionById.get(501)!.player1FeederId).toBe(401); // F <- S
    expect(positionById.get(401)!.player1FeederId).toBe(301); // S <- Q
    expect(positionById.get(301)!.player1FeederId).toBe(201); // Q <- R2
    expect(positionById.get(201)!.player2FeederId).toBe(102); // R2 <- R1 (lord goatic era player2 en el 201)
  });

  it("un jugador que entra por bye enlaza con su propia tarjeta de bye, no con un partido", () => {
    const { positionById } = buildBracketLayout(PERTH_2026);
    const match201 = positionById.get(201)!; // Tomico vs lord goatic
    expect(match201.player1FeederId).toBe(101); // Tomico tuvo bye real en R1 (id 101)
    expect(match201.player2FeederId).toBe(102); // lord goatic sí jugó R1

    const match202 = positionById.get(202)!; // yasmin vs federaz, los dos con bye real en R1
    expect(match202.player1FeederId).toBe(103);
    expect(match202.player2FeederId).toBe(104);
  });

  it("los partidos de la primera ronda presente nunca tienen alimentador", () => {
    const { matchesByRound } = buildBracketLayout(PERTH_2026);
    for (const m of matchesByRound.get("R1")!) {
      expect(m.player1FeederId).toBeNull();
      expect(m.player2FeederId).toBeNull();
    }
  });

  it("cada ronda queda en su orden real (sortIndex), no en el de `.y`", () => {
    // `.y` (media de alimentadores, o posición de respaldo si no tiene ninguno) es
    // solo informativo — el orden que importa (el que consume `bracketGeometry.ts`)
    // es el de la lista en sí, que sale directo de `sortIndex`.
    const { matchesByRound } = buildBracketLayout(PERTH_2026);
    for (const round of ["R1", "R2", "Q", "S", "F"]) {
      const sortIndexes = matchesByRound.get(round)!.map((m) => m.match.sortIndex);
      expect(sortIndexes).toEqual([...sortIndexes].sort((a, b) => a - b));
    }
  });
});

describe("buildBracketLayout — alineación por promedio, con byes ya sintetizados por quien llama", () => {
  // Un bye no tiene fila propia en `matches` (nunca se archivó, ver docs/estructura.md
  // §3) — este módulo no sabe nada de "jugador Bye": quien llama (la página de
  // torneo) sintetiza una tarjeta de bye como un partido más (gana automáticamente,
  // alimenta a la ronda siguiente exactamente igual que un partido real) ANTES de
  // pasar la lista aquí. Reproduce un cuadro de 8 con dos byes en R1 (jugadores 900 y
  // 901), cada uno con su propia tarjeta sintética.
  const BYE = 900;
  const BYE2 = 901;
  const R1: BracketMatchInput[] = [
    { id: 101, round: "R1", player1Id: 1, player2Id: 2, winnerId: 1, sortIndex: 0 },
    { id: 102, round: "R1", player1Id: 3, player2Id: BYE, winnerId: 3, sortIndex: 1 }, // tarjeta de bye sintética
    { id: 103, round: "R1", player1Id: 5, player2Id: 6, winnerId: 6, sortIndex: 2 },
    { id: 104, round: "R1", player1Id: 7, player2Id: BYE2, winnerId: 7, sortIndex: 3 }, // tarjeta de bye sintética
  ];
  const R2: BracketMatchInput[] = [
    { id: 201, round: "R2", player1Id: 1, player2Id: 3, winnerId: 3, sortIndex: 0 },
    { id: 202, round: "R2", player1Id: 6, player2Id: 7, winnerId: 7, sortIndex: 1 },
  ];
  const Q: BracketMatchInput[] = [{ id: 301, round: "Q", player1Id: 3, player2Id: 7, winnerId: 3, sortIndex: 0 }];

  it("con las 4 plazas de R1 representadas (reales o bye), R1 no tiene huecos y cada partido de R2 cae exactamente entre sus dos alimentadores", () => {
    const { matchesByRound } = buildBracketLayout([...R1, ...R2, ...Q]);
    expect(matchesByRound.get("R1")!.map((m) => m.y)).toEqual([0, 1, 2, 3]);
    // 201 (1 vs 3) alimentado por 101 (y=0) y 102 (y=1) -> media 0.5
    // 202 (6 vs 7) alimentado por 103 (y=2) y 104 (y=3) -> media 2.5
    expect(matchesByRound.get("R2")!.map((m) => m.y)).toEqual([0.5, 2.5]);
  });

  it("nunca hay dos partidos de la misma ronda con la misma y (sin cartas superpuestas)", () => {
    const { roundOrder, matchesByRound } = buildBracketLayout([...R1, ...R2, ...Q]);
    for (const round of roundOrder) {
      const ys = matchesByRound.get(round)!.map((m) => m.y);
      expect(new Set(ys).size).toBe(ys.length);
    }
  });

  it("el orden real no depende de en qué posición del array llegan las tarjetas de bye (reproduce el bug reportado)", () => {
    // `app/tournaments/[id]/page.tsx` construye los partidos reales primero y las
    // tarjetas de bye DESPUÉS, todas juntas al final del array — es más simple de
    // construir así. El orden real de cada ronda sale de `sortIndex` (posición real en
    // la rejilla fuente), que viaja pegado a cada tarjeta pase lo que pase con el orden
    // de llegada del array — a diferencia del algoritmo viejo (antes de que existiera
    // `sortIndex`), que usaba ese orden de llegada como pista y agrupaba los bye al
    // final de su ronda en vez de intercalados en su sitio real.
    const shuffled = [...R1.filter((m) => m.player2Id !== BYE && m.player2Id !== BYE2), ...R2, ...Q, ...R1.filter((m) => m.player2Id === BYE || m.player2Id === BYE2)];
    const inOrder = buildBracketLayout([...R1, ...R2, ...Q]);
    const withByesAtEnd = buildBracketLayout(shuffled);

    expect(withByesAtEnd.matchesByRound.get("R1")!.map((m) => m.match.id)).toEqual(
      inOrder.matchesByRound.get("R1")!.map((m) => m.match.id),
    );
    expect(withByesAtEnd.matchesByRound.get("R2")!.map((m) => m.match.id)).toEqual(
      inOrder.matchesByRound.get("R2")!.map((m) => m.match.id),
    );
  });

  it("la tarjeta de bye enlaza como cualquier partido real: alimenta a quien avanza", () => {
    const { positionById } = buildBracketLayout([...R1, ...R2, ...Q]);
    expect(positionById.get(201)!.player2FeederId).toBe(102); // 3 avanzó por el bye 102
    expect(positionById.get(202)!.player2FeederId).toBe(104); // 7 avanzó por el bye 104
  });
});

describe("buildBracketLayout — torneo a medias con la última ronda casi vacía (bug real de Cincinnati 2026, Trn=2092)", () => {
  // Solo 1 partido decidido en R3 (jugador 100, que entra DIRECTO en R2 — sin bye ni
  // partido en R1, como los cabezas de serie de un draw de 96 real) — así que casi
  // todo R1/R2 no se puede alcanzar por expansión hacia atrás desde R3 y cae en la
  // rama de "anomalía". Antes esa rama ordenaba por `id` (orden de inserción global,
  // sin relación con la posición real dentro de la ronda); ahora ordena por
  // `sortIndex`, así que el orden real de R1 se mantiene intacto pase lo que pase con
  // el resto del cuadro.
  const R1: BracketMatchInput[] = [
    { id: 11, round: "R1", player1Id: 1, player2Id: 2, winnerId: 1, sortIndex: 0 },
    { id: 12, round: "R1", player1Id: 3, player2Id: 4, winnerId: 3, sortIndex: 1 },
    { id: 13, round: "R1", player1Id: 5, player2Id: 6, winnerId: 5, sortIndex: 2 },
    { id: 14, round: "R1", player1Id: 7, player2Id: 8, winnerId: 7, sortIndex: 3 },
  ];
  const R2: BracketMatchInput[] = [
    { id: 21, round: "R2", player1Id: 1, player2Id: 3, winnerId: 1, sortIndex: 0 },
    { id: 22, round: "R2", player1Id: 5, player2Id: 7, winnerId: 5, sortIndex: 1 },
    // 100 entra directo aquí, sin haber jugado ni tenido bye en R1 — como Franky
    // Franchicha en el draw real: gana su único partido decidido y pasa a R3.
    { id: 23, round: "R2", player1Id: 100, player2Id: 200, winnerId: 100, sortIndex: 2 },
  ];
  const R3: BracketMatchInput[] = [{ id: 31, round: "R3", player1Id: 100, player2Id: 5, winnerId: 100, sortIndex: 0 }];

  it("R1 conserva su orden real (sortIndex), no el orden de inserción del partido 100", () => {
    const { matchesByRound } = buildBracketLayout([...R1, ...R2, ...R3]);
    expect(matchesByRound.get("R1")!.map((m) => m.match.id)).toEqual([11, 12, 13, 14]);
  });

  it("R2 conserva su orden real aunque solo uno de sus partidos llegue hasta R3", () => {
    const { matchesByRound } = buildBracketLayout([...R1, ...R2, ...R3]);
    expect(matchesByRound.get("R2")!.map((m) => m.match.id)).toEqual([21, 22, 23]);
  });

  it("el partido 100 vs 200 no tiene alimentador inventado en R1 (100 nunca jugó R1)", () => {
    const { positionById } = buildBracketLayout([...R1, ...R2, ...R3]);
    const match23 = positionById.get(23)!;
    expect(match23.player1FeederId).toBeNull();
    expect(match23.player2FeederId).toBeNull();
  });
});

describe("buildBracketLayout — huecos sin decidir enlazan por posición, no se quedan sueltos", () => {
  // Pedido explícito: el cuadro se enseña completo desde el principio, con conectores
  // hasta las rondas futuras aunque nadie sepa todavía quién las juega. R1 está
  // completo (2 partidos reales, sin huecos — como sale de verdad tras capturar
  // byes/pending, ver Cincinnati 2026 Trn=2092); R2 es un único hueco "TBD vs TBD"
  // (nadie ha ganado ninguno de los dos partidos de R1 todavía, así que la búsqueda
  // por `winnerId` no encuentra nada) — debe enlazar de todas formas con sus dos
  // alimentadores reales, por posición (hueco 0 de R2 = huecos 0 y 1 de R1).
  const TBD = -2;
  const R1: BracketMatchInput[] = [
    { id: 1, round: "R1", player1Id: 1, player2Id: 2, winnerId: null, sortIndex: 0 },
    { id: 2, round: "R1", player1Id: 3, player2Id: 4, winnerId: null, sortIndex: 1 },
  ];
  const R2: BracketMatchInput[] = [{ id: 3, round: "R2", player1Id: TBD, player2Id: TBD, winnerId: null, sortIndex: 0 }];

  it("el hueco TBD de R2 enlaza con sus dos partidos de R1 por posición", () => {
    const { positionById } = buildBracketLayout([...R1, ...R2]);
    const r2 = positionById.get(3)!;
    expect(r2.player1FeederId).toBe(1);
    expect(r2.player2FeederId).toBe(2);
  });
});

describe("roundDisplayLabel", () => {
  const roundOrder = ["R1", "R2", "Q", "S", "F"];

  it("mapea a las etiquetas clásicas por posición desde la Final", () => {
    expect(roundDisplayLabel(roundOrder, "F")).toBe("F");
    expect(roundDisplayLabel(roundOrder, "S")).toBe("SF");
    expect(roundDisplayLabel(roundOrder, "Q")).toBe("QF");
    expect(roundDisplayLabel(roundOrder, "R2")).toBe("R16");
    expect(roundDisplayLabel(roundOrder, "R1")).toBe("R32");
  });

  it("un cuadro de 8 (Q,S,F) no confunde Q con R8", () => {
    expect(roundDisplayLabel(["Q", "S", "F"], "Q")).toBe("QF");
  });
});

describe("fullRoundLadder", () => {
  it("tamaños confirmados contra datos reales (docs/estructura.md §3)", () => {
    expect(fullRoundLadder(8)).toEqual(["Q", "S", "F"]);
    expect(fullRoundLadder(16)).toEqual(["R1", "Q", "S", "F"]);
    expect(fullRoundLadder(32)).toEqual(["R1", "R2", "Q", "S", "F"]);
    expect(fullRoundLadder(64)).toEqual(["R1", "R2", "R3", "Q", "S", "F"]);
  });

  it("un draw que no es potencia de 2 redondea al alza (Cincinnati 2026, Trn=2092, draw=96 -> se comporta como 128)", () => {
    expect(fullRoundLadder(96)).toEqual(["R1", "R2", "R3", "R4", "Q", "S", "F"]);
    expect(fullRoundLadder(128)).toEqual(["R1", "R2", "R3", "R4", "Q", "S", "F"]);
  });

  it("torneo a medias: la última ronda con partidos NO es la Final todavía", () => {
    // Bug real (Cincinnati 2026): solo R1-R4 tienen partidos decididos, Q/S/F
    // siguen sin jugarse. Contar posiciones desde el final de esa lista corta
    // etiquetaba R4 como "F" y R1 como "R16" en vez de "R32".
    const ladder = fullRoundLadder(96);
    expect(roundDisplayLabel(ladder, "R1")).toBe("R128");
    expect(roundDisplayLabel(ladder, "R4")).toBe("R16");
    expect(roundDisplayLabel(ladder, "R4")).not.toBe("F");
  });
});
