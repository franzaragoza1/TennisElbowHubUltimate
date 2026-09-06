import { describe, expect, it } from "vitest";
import { decodeMatchLogHtml } from "./decodeUpload";

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
