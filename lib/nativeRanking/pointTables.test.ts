import { describe, expect, it } from "vitest";
import { getPointsByRoundForEdition, QUALIFYING_POINTS } from "./pointTables";

describe("getPointsByRoundForEdition — tablas fijas (pedido explícito, no se tocan)", () => {
  it("Grand Slam (128 de cuadro, R1..R4/Q/S/F/W)", () => {
    expect(getPointsByRoundForEdition("Grand Slam", 128)).toEqual({
      R1: 10, R2: 50, R3: 100, R4: 200, Q: 400, S: 800, F: 1300, W: 2000,
    });
  });

  it("Masters 1000 (96 de cuadro, mismo escalafón de rondas que un GS)", () => {
    expect(getPointsByRoundForEdition("Masters 1000", 96)).toEqual({
      R1: 10, R2: 30, R3: 50, R4: 100, Q: 200, S: 400, F: 650, W: 1000,
    });
  });

  it("500 (32 de cuadro, R1/R2/Q/S/F/W)", () => {
    expect(getPointsByRoundForEdition("500", 32)).toEqual({
      R1: 0, R2: 50, Q: 100, S: 200, F: 330, W: 500,
    });
  });

  it("250 (32 de cuadro)", () => {
    expect(getPointsByRoundForEdition("250", 32)).toEqual({
      R1: 0, R2: 25, Q: 50, S: 100, F: 165, W: 250,
    });
  });
});

describe("getPointsByRoundForEdition — curva proporcional derivada (Challenger/Future)", () => {
  it("CT 125 en un cuadro de 32: F=65%, S=40%, Q=20%, R2=10%, R1=5% de 125, redondeado", () => {
    expect(getPointsByRoundForEdition("CT 125", 32)).toEqual({
      R1: 6, R2: 13, Q: 25, S: 50, F: 81, W: 125,
    });
  });

  it("CT 75 en un cuadro de 16", () => {
    expect(getPointsByRoundForEdition("CT 75", 16)).toEqual({
      R1: 8, Q: 15, S: 30, F: 49, W: 75,
    });
  });

  it("Future normal (25 de campeón) en un cuadro de 32", () => {
    expect(getPointsByRoundForEdition("Future", 32)).toEqual({
      R1: 1, R2: 3, Q: 5, S: 10, F: 16, W: 25,
    });
  });

  it("Future de 8 (12 de campeón, pedido explícito, no 25)", () => {
    expect(getPointsByRoundForEdition("Future", 8)).toEqual({
      Q: 2, S: 5, F: 8, W: 12,
    });
  });
});

describe("getPointsByRoundForEdition — cuadro no estándar en un tier con tabla fija", () => {
  it("un Masters 1000 con un cuadro de 256 (R5 no está en la tabla fija) cae en la curva para R5, no en 0", () => {
    const table = getPointsByRoundForEdition("Masters 1000", 256);
    // R1..R4/Q/S/F/W siguen siendo los fijos de siempre — la curva solo rellena el hueco.
    expect(table.R1).toBe(10);
    expect(table.R4).toBe(100);
    expect(table.W).toBe(1000);
    // R5 está a distancia 3 de la Final en este cuadro de 8 rondas (R1..R5,Q,S,F) ->
    // ratio 10% de los 1000 de campeón = 100 (misma ratio que R4 tendría en un cuadro
    // de 128, donde SÍ es el fijo de la tabla — aquí solo cambia de qué ronda cuelga).
    expect(table.R5).toBe(100);
  });
});

describe("QUALIFYING_POINTS — plano, sin importar el tier (pedido explícito)", () => {
  it("Q1: 0, Q2: 3, Q3: 6", () => {
    expect(QUALIFYING_POINTS).toEqual({ Q1: 0, Q2: 3, Q3: 6 });
  });
});
