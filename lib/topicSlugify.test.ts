import { describe, expect, it } from "vitest";
import { slugify } from "./topicSlugify";

describe("slugify", () => {
  it("pasa a minúsculas y sustituye lo que no sea alfanumérico por guiones", () => {
    expect(slugify("Test topic — is the new forum any good?")).toBe("test-topic-is-the-new-forum-any-good");
  });

  it("quita acentos", () => {
    expect(slugify("¿Qué tal Rafa Nadal?")).toBe("que-tal-rafa-nadal");
  });

  it("recorta guiones al principio y al final", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("corta a 80 caracteres", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBe(80);
  });
});
