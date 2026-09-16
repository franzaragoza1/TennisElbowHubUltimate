import { describe, expect, it } from "vitest";
import { surfaceColor, surfaceDisplayLabel, surfaceFamily } from "./surfaceColors";

describe("surfaceDisplayLabel", () => {
  it("traduce las cuatro variantes conocidas", () => {
    expect(surfaceDisplayLabel("Blue-Green Cement")).toBe("Outdoor Hard");
    expect(surfaceDisplayLabel("NewLine Synthetic")).toBe("Outdoor Hard");
    expect(surfaceDisplayLabel("Indoor Concrete")).toBe("Indoor Hard");
    expect(surfaceDisplayLabel("Indoor Carpet")).toBe("Indoor Hard");
  });

  it("es insensible a mayúsculas", () => {
    expect(surfaceDisplayLabel("blue-green cement")).toBe("Outdoor Hard");
  });

  it("deja tal cual cualquier superficie no traducida", () => {
    expect(surfaceDisplayLabel("Clay")).toBe("Clay");
    expect(surfaceDisplayLabel("Grass")).toBe("Grass");
    expect(surfaceDisplayLabel("Green Clay")).toBe("Green Clay");
  });

  it("null se queda null", () => {
    expect(surfaceDisplayLabel(null)).toBeNull();
  });
});

describe("surfaceFamily / surfaceColor tras fundir Carpet en Hard", () => {
  it("Indoor Carpet cae en la familia Hard, no en una propia", () => {
    expect(surfaceFamily("Indoor Carpet")).toBe("Hard");
    expect(surfaceColor("Indoor Carpet")).toBe(surfaceColor("Indoor Concrete"));
  });
});
