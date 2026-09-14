import { describe, expect, it } from "vitest";
import { completedSetWinners } from "./liveSetWinners";

describe("completedSetWinners", () => {
  it("resalta un set anterior ya cerrado", () => {
    expect(completedSetWinners(["6", "3"], ["2", "5"])).toEqual([true, false]);
  });

  it("no resalta el último set si de verdad sigue en juego", () => {
    expect(completedSetWinners(["6", "4"], ["2", "3"])).toEqual([true, false]);
  });

  it("bug real reportado 2026-09-14: resalta el último set aunque la sesión siga abierta (6-0, 6-1 ya decidido)", () => {
    expect(completedSetWinners(["0", "1"], ["6", "6"])).toEqual([false, false]);
    expect(completedSetWinners(["6", "6"], ["0", "1"])).toEqual([true, true]);
  });

  it("resalta un 7-5 como set cerrado", () => {
    expect(completedSetWinners(["4", "7"], ["3", "5"])).toEqual([true, true]);
  });

  it("resalta un 7-6 (tie-break) como set cerrado", () => {
    expect(completedSetWinners(["4", "7"], ["3", "6"])).toEqual([true, true]);
  });

  it("un 6-5 no está cerrado (sin 2 de ventaja ni tie-break jugado)", () => {
    expect(completedSetWinners(["6"], ["5"])).toEqual([false]);
  });
});
