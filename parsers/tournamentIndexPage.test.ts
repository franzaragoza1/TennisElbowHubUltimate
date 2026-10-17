import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTournamentIndexCalendar, parseTournamentIndexTrns } from "./tournamentIndexPage";

describe("parseTournamentIndexTrns", () => {
  it("saca los Trn= de la página real, sin repetidos (semanas 42-45, 2026-10-17)", () => {
    const html = readFileSync(path.join(import.meta.dirname, "__fixtures__", "onlineTournaments.html"), "utf-8");
    expect(parseTournamentIndexTrns(html)).toEqual(["2117", "2119", "2120", "2113", "2114", "2115", "2108", "2109", "2112"]);
  });

  it("un enlace repetido cuenta una vez", () => {
    expect(parseTournamentIndexTrns('<a href="OT_ViewTournament.php?Trn=5">a</a><a href="OT_ViewTournament.php?Trn=5&x=1">b</a>')).toEqual(["5"]);
  });
});

describe("parseTournamentIndexCalendar", () => {
  it("lee los torneos anunciados sin ficha todavía (Paris, semana 45)", () => {
    const html = readFileSync(path.join(import.meta.dirname, "__fixtures__", "onlineTournaments.html"), "utf-8");
    expect(parseTournamentIndexCalendar(html)).toEqual([
      { isoWeek: 45, eventName: "Paris", competition: "Singles", drawSize: 64, surface: "Indoor Concrete", category: "Masters 1000" },
    ]);
  });
});
