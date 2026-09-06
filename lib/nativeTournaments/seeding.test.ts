import { describe, expect, it } from "vitest";
import { placeSeedsIntoBracket } from "./seeding";

describe("placeSeedsIntoBracket — cuadro lleno, todos con seed (caso simple)", () => {
  it("cuadro de 4: seed1 vs seed4, seed2 vs seed3 — el 1 y el 2 no pueden cruzarse antes de la final", () => {
    const result = placeSeedsIntoBracket(
      [
        { playerId: 101, seed: 1 },
        { playerId: 102, seed: 2 },
        { playerId: 103, seed: 3 },
        { playerId: 104, seed: 4 },
      ],
      4,
    );
    expect(result.byes).toEqual([]);
    expect(result.matches).toEqual([
      { slotIndex: 0, player1Id: 101, player2Id: 104 },
      { slotIndex: 1, player1Id: 102, player2Id: 103 },
    ]);
  });

  it("cuadro de 8: patrón estándar 1-8/4-5/2-7/3-6", () => {
    const result = placeSeedsIntoBracket(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => ({ playerId: 100 + seed, seed })),
      8,
    );
    expect(result.matches).toEqual([
      { slotIndex: 0, player1Id: 101, player2Id: 108 },
      { slotIndex: 1, player1Id: 104, player2Id: 105 },
      { slotIndex: 2, player1Id: 102, player2Id: 107 },
      { slotIndex: 3, player1Id: 103, player2Id: 106 },
    ]);
  });
});

describe("placeSeedsIntoBracket — sin bastantes inscritos para llenar el cuadro: byes a los mejores seeds", () => {
  it("cuadro de 8 con solo 6 inscritos (2 sin seed): los dos huecos que sobran son bye para seed 1 y seed 2", () => {
    const result = placeSeedsIntoBracket(
      [
        { playerId: 101, seed: 1 },
        { playerId: 102, seed: 2 },
        { playerId: 103, seed: 3 },
        { playerId: 104, seed: 4 },
        { playerId: 105, seed: null },
        { playerId: 106, seed: null },
      ],
      8,
    );
    // Orden estándar de 8: [1,8,4,5,2,7,3,6] — los slots de seed 7 y 8 (los menos
    // protegidos) son los que faltan por rellenar, así que seed 1 (slot 0, empareja
    // con el hueco de "seed 8") y seed 2 (slot 2, empareja con el hueco de "seed 7")
    // son quienes reciben el bye.
    expect(result.byes).toEqual(
      expect.arrayContaining([
        { slotIndex: 0, playerId: 101 },
        { slotIndex: 2, playerId: 102 },
      ]),
    );
    expect(result.byes).toHaveLength(2);
    expect(result.matches).toHaveLength(2);
  });

  it("cuadro de 4 con exactamente la mitad de inscritos (2): cada mitad del cuadro es un bye, cero partidos de R1", () => {
    const result = placeSeedsIntoBracket(
      [
        { playerId: 101, seed: 1 },
        { playerId: 102, seed: 2 },
      ],
      4,
    );
    expect(result.matches).toEqual([]);
    expect(result.byes).toEqual(
      expect.arrayContaining([
        { slotIndex: 0, playerId: 101 },
        { slotIndex: 1, playerId: 102 },
      ]),
    );
    expect(result.byes).toHaveLength(2);
  });
});

describe("placeSeedsIntoBracket — validaciones", () => {
  it("drawSize que no es potencia de 2: error, no intenta adivinar", () => {
    expect(() => placeSeedsIntoBracket([{ playerId: 1, seed: 1 }], 6)).toThrow();
  });

  it("menos de la mitad del cuadro inscrita: al menos una pareja se quedaría sin NINGÚN jugador real — error, no se puede resolver ese tramo del cuadro", () => {
    expect(() => placeSeedsIntoBracket([{ playerId: 1, seed: 1 }], 4)).toThrow();
  });
});
