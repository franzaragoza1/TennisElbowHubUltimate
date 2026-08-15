import { describe, expect, it } from "vitest";
import { parseTrnInput } from "./trn";

describe("parseTrnInput", () => {
  it("acepta un número suelto", () => {
    expect(parseTrnInput("2095")).toBe("2095");
    expect(parseTrnInput("  2095  ")).toBe("2095");
  });

  it("extrae el Trn= de una URL completa pegada", () => {
    expect(parseTrnInput("https://www.managames.com/Forum/OT_ViewTournament.php?Trn=2095")).toBe("2095");
    expect(parseTrnInput("OT_ViewTournament.php?Trn=2095&Foo=1")).toBe("2095");
  });

  it("rechaza lo que no trae ningún Trn=", () => {
    expect(parseTrnInput("no es nada")).toBeNull();
    expect(parseTrnInput("")).toBeNull();
  });
});
