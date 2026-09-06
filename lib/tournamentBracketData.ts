import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { byes, matches, matchVideos, pendingSlots, players, sets } from "@/db/schema";
import type { TournamentBracketMatch } from "@/components/tournament/BracketColumns";
import { BYE_PLAYER_ID, TBD_PLAYER_ID, type MatchCardData } from "@/components/tournament/MatchCard";

/**
 * Los tres tipos de fila de un cuadro (partido decidido, bye, cruce pendiente)
 * fundidos en el único shape que consume `BracketColumns` — extraído de
 * app/tournaments/[id]/page.tsx (la página pública) para que la vista de admin de un
 * torneo nativo (app/admin/(panel)/native-tournaments/[id]/page.tsx) pinte
 * exactamente el mismo cuadro sin duplicar esta consulta.
 */
export async function getBracketMatchesForEdition(editionId: number): Promise<TournamentBracketMatch[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  const matchRows = await db
    .select({
      id: matches.id,
      round: matches.round,
      outcome: matches.outcome,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Seed: matches.player1Seed,
      player2Seed: matches.player2Seed,
      player1Name: p1.displayName,
      player1Country: sql<string | null>`coalesce(${p1.countryOverride}, ${p1.country})`,
      player2Name: p2.displayName,
      player2Country: sql<string | null>`coalesce(${p2.countryOverride}, ${p2.country})`,
      sortIndex: matches.sortIndex,
    })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(eq(matches.editionId, editionId))
    .orderBy(asc(matches.id));

  const byeRows = await db
    .select({
      round: byes.round,
      playerId: byes.playerId,
      seed: byes.seed,
      sortIndex: byes.sortIndex,
      displayName: players.displayName,
      country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
    })
    .from(byes)
    .innerJoin(players, eq(players.id, byes.playerId))
    .where(eq(byes.editionId, editionId));

  const pp1 = alias(players, "pp1");
  const pp2 = alias(players, "pp2");
  const pendingRows = await db
    .select({
      id: pendingSlots.id,
      round: pendingSlots.round,
      sortIndex: pendingSlots.sortIndex,
      player1Id: pendingSlots.player1Id,
      player2Id: pendingSlots.player2Id,
      player1Seed: pendingSlots.player1Seed,
      player2Seed: pendingSlots.player2Seed,
      player1Name: pp1.displayName,
      player1Country: sql<string | null>`coalesce(${pp1.countryOverride}, ${pp1.country})`,
      player2Name: pp2.displayName,
      player2Country: sql<string | null>`coalesce(${pp2.countryOverride}, ${pp2.country})`,
    })
    .from(pendingSlots)
    .leftJoin(pp1, eq(pp1.id, pendingSlots.player1Id))
    .leftJoin(pp2, eq(pp2.id, pendingSlots.player2Id))
    .where(eq(pendingSlots.editionId, editionId));

  const matchIds = matchRows.map((m) => m.id);
  const setRows = matchIds.length > 0 ? await db.select().from(sets).where(inArray(sets.matchId, matchIds)) : [];
  const setsByMatch = new Map<number, MatchCardData["sets"]>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push({
      setNumber: s.setNumber,
      winnerGames: s.winnerGames,
      loserGames: s.loserGames,
      tiebreakLoserPoints: s.tiebreakLoserPoints,
    });
  }
  for (const list of setsByMatch.values()) list.sort((a, b) => a.setNumber - b.setNumber);

  const videoRows =
    matchIds.length > 0
      ? await db
          .select({ matchId: matchVideos.matchId, youtubeVideoId: matchVideos.youtubeVideoId })
          .from(matchVideos)
          .where(and(inArray(matchVideos.matchId, matchIds), inArray(matchVideos.status, ["auto", "confirmed"])))
      : [];
  const videoByMatch = new Map(videoRows.filter((v) => v.matchId !== null).map((v) => [v.matchId!, v.youtubeVideoId]));

  const bracketMatches: TournamentBracketMatch[] = matchRows.map((m) => ({
    id: m.id,
    round: m.round,
    player1Id: m.player1Id!,
    player2Id: m.player2Id!,
    winnerId: m.winnerId!,
    sortIndex: m.sortIndex ?? m.id,
    outcome: m.outcome as MatchCardData["outcome"],
    player1: { id: m.player1Id!, displayName: m.player1Name, country: m.player1Country, seed: m.player1Seed },
    player2: { id: m.player2Id!, displayName: m.player2Name, country: m.player2Country, seed: m.player2Seed },
    sets: setsByMatch.get(m.id) ?? [],
    youtubeVideoId: videoByMatch.get(m.id) ?? null,
  }));

  const byeMatches: TournamentBracketMatch[] = byeRows.map((b, i) => ({
    id: -1 - i,
    round: b.round,
    player1Id: b.playerId,
    player2Id: BYE_PLAYER_ID,
    winnerId: b.playerId,
    sortIndex: b.sortIndex,
    outcome: "bye",
    player1: { id: b.playerId, displayName: b.displayName, country: b.country, seed: b.seed },
    player2: { id: BYE_PLAYER_ID, displayName: "Bye", country: null, seed: null },
    sets: [],
    youtubeVideoId: null,
  }));

  const pendingMatches: TournamentBracketMatch[] = pendingRows.map((p, i) => ({
    id: -100000 - i,
    round: p.round,
    player1Id: p.player1Id ?? TBD_PLAYER_ID,
    player2Id: p.player2Id ?? TBD_PLAYER_ID,
    winnerId: null,
    sortIndex: p.sortIndex,
    outcome: "pending",
    player1:
      p.player1Id !== null
        ? { id: p.player1Id, displayName: p.player1Name!, country: p.player1Country, seed: p.player1Seed }
        : { id: TBD_PLAYER_ID, displayName: "TBD", country: null, seed: null },
    player2:
      p.player2Id !== null
        ? { id: p.player2Id, displayName: p.player2Name!, country: p.player2Country, seed: p.player2Seed }
        : { id: TBD_PLAYER_ID, displayName: "TBD", country: null, seed: null },
    sets: [],
    youtubeVideoId: null,
  }));

  return [...bracketMatches, ...byeMatches, ...pendingMatches];
}

/** Cruces YA emparejados (los dos lados conocidos) y sin resultado todavía — los
 * únicos sobre los que tiene sentido ofrecer "introducir resultado" en el panel de
 * admin de un torneo nativo. Devuelve el `id` real de `pending_slots`, no el id
 * sintético negativo que usa `getBracketMatchesForEdition` para pintar la tarjeta. */
export async function getDecidablePendingSlots(editionId: number) {
  const pp1 = alias(players, "pp1");
  const pp2 = alias(players, "pp2");
  return db
    .select({
      id: pendingSlots.id,
      round: pendingSlots.round,
      player1Id: pendingSlots.player1Id,
      player2Id: pendingSlots.player2Id,
      player1Name: pp1.displayName,
      player2Name: pp2.displayName,
    })
    .from(pendingSlots)
    .innerJoin(pp1, eq(pp1.id, pendingSlots.player1Id))
    .innerJoin(pp2, eq(pp2.id, pendingSlots.player2Id))
    .where(eq(pendingSlots.editionId, editionId));
}
