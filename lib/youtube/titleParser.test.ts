import { describe, expect, it } from "vitest";
import { parseMatchTitle } from "./titleParser";

describe("parseMatchTitle", () => {
  it("reconoce el formato fijo del canal, con seed en los dos jugadores", () => {
    expect(parseMatchTitle("Tennis Elbow 4 Madrid 2026 R32 lord goatic (1) vs J.I (16) (Online)")).toEqual({
      tournamentName: "Madrid",
      year: 2026,
      round: "R32",
      player1Name: "lord goatic",
      player1Seed: 1,
      player2Name: "J.I",
      player2Seed: 16,
    });
  });

  it("un jugador sin cabeza de serie no lleva paréntesis", () => {
    expect(parseMatchTitle("Tennis Elbow 4 Perth 2026 QF Shomyleee vs Fadvna (3) (Online)")).toEqual({
      tournamentName: "Perth",
      year: 2026,
      round: "QF",
      player1Name: "Shomyleee",
      player1Seed: null,
      player2Name: "Fadvna",
      player2Seed: 3,
    });
  });

  it("ningún jugador lleva seed", () => {
    expect(parseMatchTitle("Tennis Elbow 4 Miami 2025 R16 Tomico vs Deatekk (Online)")).toEqual({
      tournamentName: "Miami",
      year: 2025,
      round: "R16",
      player1Name: "Tomico",
      player1Seed: null,
      player2Name: "Deatekk",
      player2Seed: null,
    });
  });

  it("nombre de torneo de varias palabras", () => {
    expect(parseMatchTitle("Tennis Elbow 4 Indian Wells Masters 2026 SF Pecajordan (2) vs HSM88 (5) (Online)")).toEqual({
      tournamentName: "Indian Wells Masters",
      year: 2026,
      round: "SF",
      player1Name: "Pecajordan",
      player1Seed: 2,
      player2Name: "HSM88",
      player2Seed: 5,
    });
  });

  it("no confunde una categoría con número (Masters 1000) con el año", () => {
    const parsed = parseMatchTitle("Tennis Elbow 4 Masters 1000 Madrid 2026 F Donny (1) vs DinnoMm (2) (Online)");
    expect(parsed?.tournamentName).toBe("Masters 1000 Madrid");
    expect(parsed?.year).toBe(2026);
  });

  it("sin '(Online)' al final, no lo reconoce", () => {
    expect(parseMatchTitle("Tennis Elbow 4 Madrid 2026 R32 lord goatic (1) vs J.I (16)")).toBeNull();
  });

  it("un título completamente distinto no encaja", () => {
    expect(parseMatchTitle("Tennis Elbow 4 Online Tour — Season Recap")).toBeNull();
  });
});
