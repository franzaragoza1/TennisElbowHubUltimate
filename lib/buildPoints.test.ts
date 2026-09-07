import { describe, expect, it } from "vitest";
import { computeBuildPoints, VALID_REMAINING_POINTS } from "./buildPoints";

// Dos screenshots reales de referencia de esta sesión (2026-09-07) — distribuciones
// de stats completamente distintas, las dos construidas hasta gastar todo el
// presupuesto real del juego. Sirven de regresión real contra la fórmula: si alguien
// toca los tramos de coste más adelante y deja de dar 772 en las dos, es un bug.
const DEFENDER_BUILD = {
  forehandPower: 92,
  forehandConsistency: 100,
  forehandPrecision: 100,
  backhandPower: 92,
  backhandConsistency: 100,
  backhandPrecision: 100,
  servicePower: 96,
  serviceConsistency: 96,
  servicePrecision: 96,
  forehandVolley: 0,
  backhandVolley: 0,
  netPresence: 0,
  focus: 100,
  speed: 100,
  stamina: 98,
  muscleTone: 90,
  smash: 0,
  counter: 86,
  lob: 30,
  dropShot: 82,
  topSpin: 45,
};

const ATTACKER_BUILD = {
  forehandPower: 94,
  forehandConsistency: 96,
  forehandPrecision: 96,
  backhandPower: 96,
  backhandConsistency: 95,
  backhandPrecision: 95,
  servicePower: 96,
  serviceConsistency: 96,
  servicePrecision: 96,
  forehandVolley: 0,
  backhandVolley: 0,
  netPresence: 38,
  focus: 100,
  speed: 100,
  stamina: 96,
  muscleTone: 93,
  smash: 20,
  counter: 95,
  lob: 0,
  dropShot: 78,
  topSpin: 62,
};

describe("computeBuildPoints", () => {
  it("reproduces exactly 772 remaining for the real Defender reference build", () => {
    expect(computeBuildPoints(DEFENDER_BUILD)).toBe(VALID_REMAINING_POINTS);
  });

  it("reproduces exactly 772 remaining for the real Attacker reference build", () => {
    expect(computeBuildPoints(ATTACKER_BUILD)).toBe(VALID_REMAINING_POINTS);
  });

  it("costs 2 points to cross from 89 to 90 (still the lower tier's rate)", () => {
    const at89 = computeBuildPoints({ forehandPower: 89 });
    const at90 = computeBuildPoints({ forehandPower: 90 });
    expect(at89 - at90).toBe(2);
  });

  it("only charges 3 points per step once strictly above 90", () => {
    const at90 = computeBuildPoints({ forehandPower: 90 });
    const at91 = computeBuildPoints({ forehandPower: 91 });
    expect(at90 - at91).toBe(3);
  });

  it("top spin never affects the total regardless of its value", () => {
    expect(computeBuildPoints({ topSpin: 0 })).toBe(computeBuildPoints({ topSpin: 100 }));
  });

  it("treats missing stats as 0 (full remaining budget)", () => {
    expect(computeBuildPoints({})).toBe(2800);
  });
});
