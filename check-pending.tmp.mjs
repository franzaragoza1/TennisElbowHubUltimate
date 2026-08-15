import { readFileSync } from "node:fs";
import { parseTournamentPage } from "./parsers/tournamentPage.ts";

const html = readFileSync("data/raw/mana/2026-08-15/ot-viewtournament-trn-2092.html", "utf-8");
const page = parseTournamentPage(html, "2092");

console.log("total pending:", page.pending.length);
const byRound = {};
for (const p of page.pending) byRound[p.round] = (byRound[p.round]||0)+1;
console.log(byRound);

console.log("\nQ pending (finals table):");
for (const p of page.pending.filter(p=>p.round==="Q")) {
  console.log(`  p1=${p.player1?.displayName ?? "TBD"} vs p2=${p.player2?.displayName ?? "TBD"}`);
}
