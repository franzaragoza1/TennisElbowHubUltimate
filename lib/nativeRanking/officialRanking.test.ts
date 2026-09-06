import { describe, expect, it } from "vitest";
import { rankByPoints } from "./officialRanking";

describe("rankByPoints", () => {
  it("ordena por puntos descendente y asigna rango secuencial (1, 2, 3...)", () => {
    const result = rankByPoints([
      { playerId: 1, points: 100 },
      { playerId: 2, points: 300 },
      { playerId: 3, points: 200 },
    ]);
    expect(result).toEqual([
      { playerId: 2, points: 300, rank: 1 },
      { playerId: 3, points: 200, rank: 2 },
      { playerId: 1, points: 100, rank: 3 },
    ]);
  });

  it("empate en puntos: rango secuencial sin repetir (pedido explícito, nada de rangos compartidos estilo ATP)", () => {
    const result = rankByPoints([
      { playerId: 5, points: 100 },
      { playerId: 2, points: 100 },
    ]);
    // Desempate estable: playerId ascendente.
    expect(result).toEqual([
      { playerId: 2, points: 100, rank: 1 },
      { playerId: 5, points: 100, rank: 2 },
    ]);
  });

  it("lista vacía: lista vacía", () => {
    expect(rankByPoints([])).toEqual([]);
  });

  it("un solo jugador: rango 1", () => {
    expect(rankByPoints([{ playerId: 1, points: 50 }])).toEqual([{ playerId: 1, points: 50, rank: 1 }]);
  });
});
