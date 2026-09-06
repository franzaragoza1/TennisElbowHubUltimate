import { describe, expect, it } from "vitest";
import { namesMatch } from "./nameMatch";

describe("namesMatch", () => {
  it("igual tal cual: coincide", () => {
    expect(namesMatch("Ypsilandis_7000", "Ypsilandis_7000")).toBe(true);
  });

  it("insensible a mayúsculas", () => {
    expect(namesMatch("Iceman", "ICEMAN")).toBe(true);
  });

  it("el nombre corto de live-tennis.cn es un prefijo/sustring del handle completo de Mana Games", () => {
    // Caso real: live-tennis.cn muestra "minato", nuestra base de datos tiene el
    // handle completo "minatonamikaze1643" (apodo más corto en un sitio, no un
    // truncamiento nuestro — los dos sistemas de nombres son independientes).
    expect(namesMatch("minato", "minatonamikaze1643")).toBe(true);
    expect(namesMatch("minatonamikaze1643", "minato")).toBe(true);
  });

  it("nombres completamente distintos no coinciden", () => {
    expect(namesMatch("Miro", "MakkFlary")).toBe(false);
  });

  it("un nombre demasiado corto (1-2 caracteres) nunca hace de sustring válido, para no casar con cualquier cosa", () => {
    expect(namesMatch("Al", "Alvarez")).toBe(false);
    expect(namesMatch("A", "Aaron")).toBe(false);
  });

  it('TE4 abrevia "Nombre Apellido" como "N.Apellido" (mismo motivo que lib/matchLog/nameIndex.ts) — cuenta como el mismo jugador', () => {
    expect(namesMatch("M.Girardi", "Michele Girardi")).toBe(true);
    expect(namesMatch("Michele Girardi", "M.Girardi")).toBe(true);
    expect(namesMatch("M. Girardi", "Michele Girardi")).toBe(true);
  });

  it("la forma abreviada no casa si la inicial o el apellido no cuadran", () => {
    expect(namesMatch("X.Girardi", "Michele Girardi")).toBe(false);
    expect(namesMatch("M.Rossi", "Michele Girardi")).toBe(false);
  });
});
