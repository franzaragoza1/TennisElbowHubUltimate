import { describe, expect, it } from "vitest";
import { getCourtPhysicsForTournament } from "./courtPhysics";

describe("getCourtPhysicsForTournament", () => {
  it("encuentra un torneo con una sola fila en el CSV", () => {
    const result = getCourtPhysicsForTournament("United Cup");
    expect(result).toEqual({ tournamentLabel: "United Cup", courtPaceIndex: 37.5, speedCategory: "Medium", physicsSurface: "NewLine Synthetic" });
  });

  it("resuelve varias filas (ATP/WTA de la misma ciudad) cuando coinciden en los físicos reales", () => {
    const result = getCourtPhysicsForTournament("Cincinnati");
    expect(result?.physicsSurface).toBe("Blue-green Cement");
    expect(result?.courtPaceIndex).toBe(37);
  });

  it("no adivina cuando de verdad hay dos torneos distintos con superficies distintas bajo el mismo nombre", () => {
    // Stuttgart tiene un ATP 250 en hierba y un WTA 500 en tierra — ambigüedad real.
    expect(getCourtPhysicsForTournament("Stuttgart")).toBeNull();
  });

  it("ignora un sufijo de puntuación distinto (guion vs espacio)", () => {
    expect(getCourtPhysicsForTournament("Monte-Carlo")?.physicsSurface).toBe("Clay");
    expect(getCourtPhysicsForTournament("Winston-Salem")?.physicsSurface).toBe("Blue-green Cement");
  });

  it("resuelve los alias explícitos de Grand Slam", () => {
    expect(getCourtPhysicsForTournament("Australian Open")?.physicsSurface).toBe("NewLine Synthetic");
    expect(getCourtPhysicsForTournament("Roland Garros")?.physicsSurface).toBe("Clay");
    expect(getCourtPhysicsForTournament("Roland Garros [TE4]")?.physicsSurface).toBe("Clay");
    expect(getCourtPhysicsForTournament("Rome")?.physicsSurface).toBe("Clay");
  });

  it("devuelve null para un torneo que no existe en el CSV", () => {
    expect(getCourtPhysicsForTournament("Nonexistent City")).toBeNull();
  });

  it("devuelve null para un nombre vacío", () => {
    expect(getCourtPhysicsForTournament("")).toBeNull();
    expect(getCourtPhysicsForTournament("   ")).toBeNull();
  });
});
