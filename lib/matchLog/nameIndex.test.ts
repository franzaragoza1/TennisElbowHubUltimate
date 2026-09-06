import { describe, expect, it } from "vitest";
import { resolvePlayerIdFromIndex, type NameIndex } from "./nameIndex";

function index(exactEntries: [string, number[]][], twoWord: NameIndex["twoWord"] = []): NameIndex {
  return { exact: new Map(exactEntries.map(([name, ids]) => [name, new Set(ids)])), twoWord };
}

describe("resolvePlayerIdFromIndex", () => {
  it("resuelve por nombre exacto, insensible a mayúsculas", () => {
    const idx = index([["gyrmik", [1]]]);
    expect(resolvePlayerIdFromIndex(idx, "Gyrmik")).toBe(1);
    expect(resolvePlayerIdFromIndex(idx, "GYRMIK")).toBe(1);
  });

  it("dos jugadores con el mismo nombre exacto (mote duplicado, alias sin resincronizar...) nunca se adivina: null", () => {
    const idx = index([["jira", [1, 2]]]);
    expect(resolvePlayerIdFromIndex(idx, "Jira")).toBeNull();
  });

  it("nombre desconocido y sin forma abreviada: null", () => {
    const idx = index([["gyrmik", [1]]]);
    expect(resolvePlayerIdFromIndex(idx, "Random Opponent")).toBeNull();
  });

  it('"N.Apellido" resuelve contra un nombre de dos palabras único', () => {
    const idx = index(
      [["michele girardi", [1]]],
      [{ playerId: 1, firstWord: "michele", secondWord: "girardi" }],
    );
    expect(resolvePlayerIdFromIndex(idx, "M.Girardi")).toBe(1);
    expect(resolvePlayerIdFromIndex(idx, "M. Girardi")).toBe(1);
  });

  it('"N.Apellido" ambiguo entre dos jugadores con la misma inicial y apellido: null', () => {
    const idx = index(
      [
        ["michele girardi", [1]],
        ["marco girardi", [2]],
      ],
      [
        { playerId: 1, firstWord: "michele", secondWord: "girardi" },
        { playerId: 2, firstWord: "marco", secondWord: "girardi" },
      ],
    );
    expect(resolvePlayerIdFromIndex(idx, "M.Girardi")).toBeNull();
  });

  it("un nombre corto casual con punto detrás no se trata como abreviatura si la inicial no cuadra", () => {
    const idx = index(
      [["michele girardi", [1]]],
      [{ playerId: 1, firstWord: "michele", secondWord: "girardi" }],
    );
    expect(resolvePlayerIdFromIndex(idx, "X.Girardi")).toBeNull();
  });

  it("solo se prueba la forma abreviada si el nombre exacto no resolvió nada", () => {
    // Un jugador real llamado literalmente "M.Someone" (raro, pero si existiera como
    // nombre exacto en el índice) gana siempre al intento de interpretarlo como
    // abreviatura de otra persona.
    const idx = index([["m.someone", [9]]], [{ playerId: 1, firstWord: "mike", secondWord: "someone" }]);
    expect(resolvePlayerIdFromIndex(idx, "M.Someone")).toBe(9);
  });
});
