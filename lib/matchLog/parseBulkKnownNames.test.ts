import { describe, expect, it } from "vitest";
import { parseBulkKnownNames } from "./parseBulkKnownNames";

describe("parseBulkKnownNames", () => {
  it("un jugador, varios alias", () => {
    const { blocks, malformed } = parseBulkKnownNames("Gyrmik: OldNick, M.Girardi");
    expect(malformed).toEqual([]);
    expect(blocks).toEqual([{ nameQuery: "Gyrmik", aliases: ["OldNick", "M.Girardi"] }]);
  });

  it("varios jugadores separados por ;", () => {
    const { blocks } = parseBulkKnownNames("Gyrmik: OldNick, M.Girardi; Jira: Jirko");
    expect(blocks).toEqual([
      { nameQuery: "Gyrmik", aliases: ["OldNick", "M.Girardi"] },
      { nameQuery: "Jira", aliases: ["Jirko"] },
    ]);
  });

  it("espacios de sobra y ; final no rompen nada", () => {
    const { blocks } = parseBulkKnownNames("  Gyrmik :  OldNick , M.Girardi  ;  Jira: Jirko ;  ");
    expect(blocks).toEqual([
      { nameQuery: "Gyrmik", aliases: ["OldNick", "M.Girardi"] },
      { nameQuery: "Jira", aliases: ["Jirko"] },
    ]);
  });

  it("un bloque sin ':' se marca como mal formado, sin tirar abajo los demás", () => {
    const { blocks, malformed } = parseBulkKnownNames("Gyrmik: OldNick; esto no tiene dos puntos; Jira: Jirko");
    expect(blocks).toEqual([
      { nameQuery: "Gyrmik", aliases: ["OldNick"] },
      { nameQuery: "Jira", aliases: ["Jirko"] },
    ]);
    expect(malformed).toEqual(["esto no tiene dos puntos"]);
  });

  it("un bloque sin ningún alias real (comas vacías) también se marca como mal formado", () => {
    const { blocks, malformed } = parseBulkKnownNames("Gyrmik: , , ");
    expect(blocks).toEqual([]);
    expect(malformed).toEqual(["Gyrmik: , ,"]);
  });

  it("entrada vacía no produce ni bloques ni errores", () => {
    expect(parseBulkKnownNames("")).toEqual({ blocks: [], malformed: [] });
    expect(parseBulkKnownNames("   ")).toEqual({ blocks: [], malformed: [] });
  });
});
