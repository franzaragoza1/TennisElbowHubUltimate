import { describe, expect, it } from "vitest";
import { decodeMatchLogHtml, isValidMatchLogFileName } from "./decodeUpload";

function utf8Buffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("decodeMatchLogHtml", () => {
  it("decodes plain ASCII the same as before", () => {
    expect(decodeMatchLogHtml(utf8Buffer("Gyrmik def. Jira"))).toBe("Gyrmik def. Jira");
  });

  it("decodes real UTF-8 accented names correctly instead of iso-8859-1 mojibake", () => {
    expect(decodeMatchLogHtml(utf8Buffer("Gabriel LOURENÇO def. José"))).toBe("Gabriel LOURENÇO def. José");
  });

  it("falls back to iso-8859-1 for a byte sequence that isn't valid UTF-8", () => {
    // 0xE9 sola es "é" en iso-8859-1, pero una secuencia UTF-8 inválida por sí sola
    // (ningún byte de continuación 10xxxxxx detrás de un byte de cabecera 11xxxxxx).
    const bytes = new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]); // "Jos" + 0xE9
    expect(decodeMatchLogHtml(bytes.buffer)).toBe("José");
  });
});

describe("isValidMatchLogFileName", () => {
  it("accepts the real TrainingClub export name", () => {
    expect(isValidMatchLogFileName("MatchLog - TrainingClub.001.html")).toBe(true);
    expect(isValidMatchLogFileName("MatchLog - TrainingClub.42.html")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidMatchLogFileName("matchlog - trainingclub.1.HTML")).toBe(true);
  });

  it("rejects a different profile's MatchLog", () => {
    expect(isValidMatchLogFileName("MatchLog - Gyrmik.001.html")).toBe(false);
  });

  it("rejects a file that only resembles the pattern", () => {
    expect(isValidMatchLogFileName("MatchLog - TrainingClub.html")).toBe(false);
    expect(isValidMatchLogFileName("MatchLog - TrainingClub.001.htm")).toBe(false);
    expect(isValidMatchLogFileName("notes.txt")).toBe(false);
  });
});
