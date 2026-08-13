import { describe, expect, it } from "vitest";
import { buildBracketLayout, roundDisplayLabel, type BracketMatchInput } from "./bracket";

/**
 * Datos reales de Perth 2026 (Trn=2024, editionId=176, cuadro de 32), verificados a
 * mano contra la base de datos antes de escribir el algoritmo — ver plan de la fase
 * "cuadro de torneo". Nombres en comentario, solo hacen falta los ids para el test.
 */
// 1 lord goatic · 2 hrvoje996 · 3 J.I · 4 jus · 5 CaptainCrazy · 6 Deatekk
// 7 GregoryDuViveiro · 8 Shomyleee · 9 ToeKnee · 10 Fadvna · 11 Tomico · 12 yasmin
// 13 federaz · 14 bencu · 15 Psyroroo · 16 Pecajordan · 17 HSM88 · 18 Nazhouh
// 19 Donny · 20 DinnoMm · 21 Ericpova
const PERTH_2026: BracketMatchInput[] = [
  // R1
  { id: 101, round: "R1", player1Id: 1, player2Id: 2, winnerId: 1 },
  { id: 102, round: "R1", player1Id: 3, player2Id: 4, winnerId: 3 },
  { id: 103, round: "R1", player1Id: 5, player2Id: 6, winnerId: 6 },
  { id: 104, round: "R1", player1Id: 7, player2Id: 8, winnerId: 8 },
  { id: 105, round: "R1", player1Id: 9, player2Id: 10, winnerId: 10 },
  // R2
  { id: 201, round: "R2", player1Id: 11, player2Id: 1, winnerId: 1 },
  { id: 202, round: "R2", player1Id: 12, player2Id: 13, winnerId: 12 },
  { id: 203, round: "R2", player1Id: 14, player2Id: 3, winnerId: 14 },
  { id: 204, round: "R2", player1Id: 6, player2Id: 15, winnerId: 6 },
  { id: 205, round: "R2", player1Id: 16, player2Id: 8, winnerId: 8 },
  { id: 206, round: "R2", player1Id: 17, player2Id: 18, winnerId: 18 },
  { id: 207, round: "R2", player1Id: 19, player2Id: 20, winnerId: 19 },
  { id: 208, round: "R2", player1Id: 10, player2Id: 21, winnerId: 10 },
  // Cuartos
  { id: 301, round: "Q", player1Id: 1, player2Id: 12, winnerId: 1 },
  { id: 302, round: "Q", player1Id: 14, player2Id: 6, winnerId: 14 },
  { id: 303, round: "Q", player1Id: 8, player2Id: 18, winnerId: 8 },
  { id: 304, round: "Q", player1Id: 19, player2Id: 10, winnerId: 10 },
  // Semis
  { id: 401, round: "S", player1Id: 1, player2Id: 14, winnerId: 1 },
  { id: 402, round: "S", player1Id: 8, player2Id: 10, winnerId: 8 },
  // Final
  { id: 501, round: "F", player1Id: 1, player2Id: 8, winnerId: 8 },
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
    expect(positionById.get(201)!.player2FeederId).toBe(101); // R2 <- R1 (lord goatic era player2 en el 201)
  });

  it("un jugador que entra por bye no tiene partido que lo alimente", () => {
    const { positionById } = buildBracketLayout(PERTH_2026);
    const match201 = positionById.get(201)!; // Tomico vs lord goatic
    expect(match201.player1FeederId).toBeNull(); // Tomico entró directo en R2 (bye)
    expect(match201.player2FeederId).toBe(101); // lord goatic sí jugó R1

    const match202 = positionById.get(202)!; // yasmin vs federaz, ambos con bye
    expect(match202.player1FeederId).toBeNull();
    expect(match202.player2FeederId).toBeNull();
  });

  it("los partidos de la primera ronda presente nunca tienen alimentador", () => {
    const { matchesByRound } = buildBracketLayout(PERTH_2026);
    for (const m of matchesByRound.get("R1")!) {
      expect(m.player1FeederId).toBeNull();
      expect(m.player2FeederId).toBeNull();
    }
  });

  it("las rondas quedan ordenadas verticalmente de forma consistente", () => {
    const { matchesByRound } = buildBracketLayout(PERTH_2026);
    for (const round of ["R1", "R2", "Q", "S", "F"]) {
      const ys = matchesByRound.get(round)!.map((m) => m.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
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
