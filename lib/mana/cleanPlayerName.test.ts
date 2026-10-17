import { describe, expect, it } from "vitest";
import { cleanPlayerName } from "./playerName";

describe("cleanPlayerName", () => {
  it("quita una etiqueta (By …) al final del nombre", () => {
    expect(cleanPlayerName("Gyrmik (By RL)")).toBe("Gyrmik");
    expect(cleanPlayerName("Gyrmik (by rl)")).toBe("Gyrmik");
    expect(cleanPlayerName("Franky Franchicha  (By Some Team) ")).toBe("Franky Franchicha");
  });

  it("deja el resto de nombres tal cual", () => {
    expect(cleanPlayerName("Gyrmik")).toBe("Gyrmik");
    expect(cleanPlayerName("Byron (CHI)")).toBe("Byron (CHI)");
    expect(cleanPlayerName("Ace (Bye)")).toBe("Ace (Bye)");
    expect(cleanPlayerName("Mr. By")).toBe("Mr. By");
  });

  it("nunca deja un nombre vacío", () => {
    expect(cleanPlayerName("(By RL)")).toBe("(By RL)");
  });
});
