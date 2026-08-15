import { desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { recentResults, recentResultSets, editions, events, players } from "@/db/schema";
import { tournamentCircuit, type TournamentCircuit } from "./tournamentCircuit";

export interface ScoreMatchRow {
  id: number;
  reportedAt: Date;
  round: string;
  outcome: string;
  winner: { id: number; displayName: string; country: string | null };
  loser: { id: number; displayName: string; country: string | null };
  sets: { setNumber: number; winnerGames: number; loserGames: number; tiebreakLoserPoints: number | null }[];
}

export interface TournamentScoresBlock {
  editionId: number;
  tournamentName: string;
  category: string;
  surface: string;
  drawSize: number;
  year: number;
  isoWeek: number | null;
  matches: ScoreMatchRow[];
}

/** Tope de partidos por torneo — pedido explícito ("last 6 reported scores"). Cada
 * bloque solo enseña sus últimos `RECENT_LIMIT`, aunque haya reportado más. */
const RECENT_LIMIT = 6;

/**
 * Resultados recientes agrupados por torneo, para un circuito concreto (ATP Tour,
 * Challenger o Futures — ver `lib/tournamentCircuit.ts`). Solo entran filas con
 * edición resuelta: sin edición no hay forma de saber a qué circuito pertenecen
 * (`OT_LastResults.php` no lo dice, se deriva de `editions.category`), así que se
 * quedan fuera en vez de adivinar.
 */
export async function getRecentScoresByCircuit(circuit: TournamentCircuit): Promise<TournamentScoresBlock[]> {
  const w = alias(players, "w");
  const l = alias(players, "l");

  const rows = await db
    .select({
      id: recentResults.id,
      reportedAt: recentResults.reportedAt,
      round: recentResults.round,
      outcome: recentResults.outcome,
      editionId: editions.id,
      tournamentName: events.displayName,
      category: editions.category,
      surface: editions.surface,
      drawSize: editions.drawSize,
      year: editions.year,
      isoWeek: editions.isoWeek,
      winnerId: w.id,
      winnerName: w.displayName,
      winnerCountry: w.country,
      loserId: l.id,
      loserName: l.displayName,
      loserCountry: l.country,
    })
    .from(recentResults)
    .innerJoin(editions, eq(editions.id, recentResults.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(w, eq(w.id, recentResults.winnerId))
    .innerJoin(l, eq(l.id, recentResults.loserId))
    .orderBy(desc(recentResults.reportedAt));

  const filtered = rows.filter((r) => tournamentCircuit(r.category) === circuit);
  if (filtered.length === 0) return [];

  const setRows = await db
    .select()
    .from(recentResultSets)
    .where(inArray(recentResultSets.resultId, filtered.map((r) => r.id)));
  const setsByResult = new Map<number, ScoreMatchRow["sets"]>();
  for (const s of setRows) {
    if (!setsByResult.has(s.resultId)) setsByResult.set(s.resultId, []);
    setsByResult.get(s.resultId)!.push({
      setNumber: s.setNumber,
      winnerGames: s.winnerGames,
      loserGames: s.loserGames,
      tiebreakLoserPoints: s.tiebreakLoserPoints,
    });
  }
  for (const list of setsByResult.values()) list.sort((a, b) => a.setNumber - b.setNumber);

  const blocks = new Map<number, TournamentScoresBlock>();
  for (const r of filtered) {
    if (!blocks.has(r.editionId)) {
      blocks.set(r.editionId, {
        editionId: r.editionId,
        tournamentName: r.tournamentName,
        category: r.category,
        surface: r.surface,
        drawSize: r.drawSize,
        year: r.year,
        isoWeek: r.isoWeek,
        matches: [],
      });
    }
    const block = blocks.get(r.editionId)!;
    if (block.matches.length >= RECENT_LIMIT) continue; // `rows` ya viene ordenado por reportedAt desc
    block.matches.push({
      id: r.id,
      reportedAt: r.reportedAt,
      round: r.round,
      outcome: r.outcome,
      winner: { id: r.winnerId, displayName: r.winnerName, country: r.winnerCountry },
      loser: { id: r.loserId, displayName: r.loserName, country: r.loserCountry },
      sets: setsByResult.get(r.id) ?? [],
    });
  }

  // Bloques ordenados por actividad más reciente — cada uno ya trae su primer
  // partido como el más nuevo (misma ordenación heredada de `rows`).
  return [...blocks.values()].sort((a, b) => b.matches[0].reportedAt.getTime() - a.matches[0].reportedAt.getTime());
}

export type { TournamentCircuit };
