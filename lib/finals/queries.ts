import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { finalsEditions, finalsMatches, finalsParticipants, finalsSets, players } from "@/db/schema";
import type { FinalsMatchResult } from "./types";
import { computeGroupStandings, sortStandings, type FinalsParticipantInfo } from "./standings";
import { computeQualificationStatus, type QualStatus } from "./qualification";
import type { FinalsFormat } from "./format";

export async function getGroupParticipants(
  finalsEditionId: number,
  group: "A" | "B",
): Promise<FinalsParticipantInfo[]> {
  return db
    .select({ playerId: finalsParticipants.playerId, seed: finalsParticipants.seed })
    .from(finalsParticipants)
    .where(
      and(
        eq(finalsParticipants.finalsEditionId, finalsEditionId),
        eq(finalsParticipants.group, group),
        eq(finalsParticipants.status, "active"),
      ),
    );
}

export interface FinalsEditionListItem {
  id: number;
  kind: "tour_finals" | "next_gen_finals";
  year: number;
  displayName: string;
  status: "setup" | "groups" | "knockout" | "completed";
  championId: number | null;
  championName: string | null;
  championCountry: string | null;
  runnerUpName: string | null;
  runnerUpCountry: string | null;
  finalScore: string | null;
}

/** Igual que `listFinalsEditions` de antes, pero con lo que hace falta para pintar
 * `TournamentCard` (campeón CON país, finalista y marcador) — la tarjeta de Finals
 * pide reusar la misma tarjeta/animación que un torneo normal, así que necesita la
 * misma forma de datos. */
export async function listFinalsEditions(): Promise<FinalsEditionListItem[]> {
  const editions = await db.select().from(finalsEditions).orderBy(desc(finalsEditions.year), desc(finalsEditions.id));
  if (editions.length === 0) return [];

  const finals = await db
    .select()
    .from(finalsMatches)
    .where(and(inArray(finalsMatches.finalsEditionId, editions.map((e) => e.id)), eq(finalsMatches.slot, "F")));

  const playerIds = new Set<number>();
  for (const f of finals) {
    if (f.winnerId) playerIds.add(f.winnerId);
    if (f.player1Id) playerIds.add(f.player1Id);
    if (f.player2Id) playerIds.add(f.player2Id);
  }
  const playerRows =
    playerIds.size > 0
      ? await db
          .select({ id: players.id, displayName: players.displayName, country: players.country })
          .from(players)
          .where(inArray(players.id, [...playerIds]))
      : [];
  const playerById = new Map(playerRows.map((p) => [p.id, p]));
  const finalByEdition = new Map(finals.map((f) => [f.finalsEditionId, f]));

  return editions.map((e) => {
    const final = finalByEdition.get(e.id);
    const championId = final?.winnerId ?? null;
    const champion = championId ? playerById.get(championId) : undefined;
    const runnerUpId =
      final?.winnerId && final.player1Id && final.player2Id
        ? final.winnerId === final.player1Id
          ? final.player2Id
          : final.player1Id
        : null;
    const runnerUp = runnerUpId ? playerById.get(runnerUpId) : undefined;

    return {
      id: e.id,
      kind: e.kind as "tour_finals" | "next_gen_finals",
      year: e.year,
      displayName: e.displayName,
      status: e.status as FinalsEditionListItem["status"],
      championId,
      championName: champion?.displayName ?? null,
      championCountry: champion?.country ?? null,
      runnerUpName: runnerUp?.displayName ?? null,
      runnerUpCountry: runnerUp?.country ?? null,
      finalScore: final?.scoreRaw ?? null,
    };
  });
}

export interface GroupMatchState {
  played: FinalsMatchResult[];
  scheduledMatchIds: number[];
  remainingPairs: [number, number][];
}

export async function getGroupMatchState(finalsEditionId: number, group: "A" | "B"): Promise<GroupMatchState> {
  const rows = await db
    .select()
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.stage, "group"), eq(finalsMatches.group, group)));

  const playedRows = rows.filter((r) => r.outcome !== "scheduled" && r.winnerId !== null);
  const scheduledRows = rows.filter((r) => r.outcome === "scheduled");

  const matchIds = playedRows.map((r) => r.id);
  const setRows = matchIds.length > 0 ? await db.select().from(finalsSets).where(inArray(finalsSets.matchId, matchIds)) : [];
  setRows.sort((a, b) => a.setNumber - b.setNumber);
  const setsByMatch = new Map<number, { winnerGames: number; loserGames: number }[]>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push({ winnerGames: s.winnerGames, loserGames: s.loserGames });
  }

  const played: FinalsMatchResult[] = playedRows.map((r) => ({
    id: r.id,
    player1Id: r.player1Id!,
    player2Id: r.player2Id!,
    winnerId: r.winnerId!,
    sets: setsByMatch.get(r.id) ?? [],
  }));

  return {
    played,
    scheduledMatchIds: scheduledRows.map((r) => r.id),
    remainingPairs: scheduledRows.map((r) => [r.player1Id!, r.player2Id!]),
  };
}

export interface GroupStandingsRow {
  playerId: number;
  displayName: string;
  country: string | null;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  /** null una vez el grupo está completo — ya no hace falta el badge, la tabla ordenada dice la verdad. */
  qualStatus: QualStatus | null;
}

/** Tabla de grupo lista para pintar: standings ordenados (desempate oficial) + Q/E
 * "score-bound" mientras el grupo siga en juego. `format` decide cómo se enumeran
 * los posibles marcadores de los partidos pendientes (2-0/2-1 al mejor de 3, hasta
 * 3-0/3-1/3-2 al mejor de 5). */
export async function getGroupStandingsRows(
  finalsEditionId: number,
  group: "A" | "B",
  format: FinalsFormat,
): Promise<GroupStandingsRow[]> {
  const [participants, matchState] = await Promise.all([
    getGroupParticipants(finalsEditionId, group),
    getGroupMatchState(finalsEditionId, group),
  ]);
  if (participants.length === 0) return [];

  const table = sortStandings(computeGroupStandings(participants, matchState.played), matchState.played);
  const qualification =
    matchState.remainingPairs.length > 0
      ? computeQualificationStatus({
          participants,
          playedMatches: matchState.played,
          remainingPairs: matchState.remainingPairs,
          format,
        })
      : null;
  // Grupo terminado (nada pendiente, y de verdad se ha jugado algo — no el caso de un
  // grupo que ni siquiera ha arrancado, donde remainingPairs también sale vacío porque
  // no hay partidos programados todavía): la tabla ya está ordenada de verdad por el
  // desempate oficial, así que el 1º y 2º de cada grupo SON los clasificados, sin
  // necesidad de simular escenarios. Antes se dejaba en null en cuanto acababa el
  // grupo (la idea era "la tabla ya lo dice"), pero eso apaga justo la marca que hace
  // falta para ver de un vistazo quién pasó a semis.
  const isGroupComplete = matchState.remainingPairs.length === 0 && matchState.played.length > 0;

  const playerRows = await db
    .select({ id: players.id, displayName: players.displayName, country: players.country })
    .from(players)
    .where(inArray(players.id, participants.map((p) => p.playerId)));
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  return table.map((s, i) => ({
    playerId: s.playerId,
    displayName: playerById.get(s.playerId)?.displayName ?? "Unknown",
    country: playerById.get(s.playerId)?.country ?? null,
    seed: s.seed,
    played: s.played,
    wins: s.wins,
    losses: s.losses,
    setsWon: s.setsWon,
    setsLost: s.setsLost,
    gamesWon: s.gamesWon,
    gamesLost: s.gamesLost,
    qualStatus: qualification ? qualification[s.playerId] : isGroupComplete ? (i < 2 ? "qualified" : "eliminated") : null,
  }));
}

export interface GroupMatchDisplay {
  id: number;
  player1: { id: number; displayName: string; country: string | null };
  player2: { id: number; displayName: string; country: string | null };
  winnerId: number | null;
  outcome: "scheduled" | "played" | "retired" | "disqualified";
  sets: { winnerGames: number; loserGames: number; tiebreakLoserPoints: number | null }[];
}

/** Todos los cruces del grupo (jugados y por jugar), no solo la tabla agregada — la
 * página pública necesita poder mostrar quién jugó contra quién y con qué marcador. */
export async function getGroupMatches(finalsEditionId: number, group: "A" | "B"): Promise<GroupMatchDisplay[]> {
  const rows = await db
    .select()
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.stage, "group"), eq(finalsMatches.group, group)));
  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.id);
  const setRows = await db.select().from(finalsSets).where(inArray(finalsSets.matchId, matchIds));
  setRows.sort((a, b) => a.setNumber - b.setNumber);
  const setsByMatch = new Map<number, GroupMatchDisplay["sets"]>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push({ winnerGames: s.winnerGames, loserGames: s.loserGames, tiebreakLoserPoints: s.tiebreakLoserPoints });
  }

  const playerIds = [...new Set(rows.flatMap((r) => [r.player1Id, r.player2Id]).filter((id): id is number => id !== null))];
  const playerRows =
    playerIds.length > 0
      ? await db.select({ id: players.id, displayName: players.displayName, country: players.country }).from(players).where(inArray(players.id, playerIds))
      : [];
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  return rows.map((r) => ({
    id: r.id,
    player1: playerById.get(r.player1Id!) ?? { id: r.player1Id!, displayName: "Unknown", country: null },
    player2: playerById.get(r.player2Id!) ?? { id: r.player2Id!, displayName: "Unknown", country: null },
    winnerId: r.winnerId,
    outcome: r.outcome as GroupMatchDisplay["outcome"],
    sets: setsByMatch.get(r.id) ?? [],
  }));
}

export interface KnockoutMatchDisplay {
  id: number;
  slot: "SF1" | "SF2" | "F";
  label: string;
  player1: { id: number; displayName: string; country: string | null } | null;
  player2: { id: number; displayName: string; country: string | null } | null;
  winnerId: number | null;
  outcome: "scheduled" | "played" | "retired" | "disqualified";
  sets: { winnerGames: number; loserGames: number; tiebreakLoserPoints: number | null }[];
}

const SLOT_LABEL: Record<string, string> = { SF1: "Semifinal 1", SF2: "Semifinal 2", F: "Final" };
const SLOT_ORDER: Record<string, number> = { SF1: 0, SF2: 1, F: 2 };

export async function getKnockoutMatches(finalsEditionId: number): Promise<KnockoutMatchDisplay[]> {
  const rows = await db
    .select()
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), inArray(finalsMatches.stage, ["semifinal", "final"])));
  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.id);
  const setRows = await db.select().from(finalsSets).where(inArray(finalsSets.matchId, matchIds));
  setRows.sort((a, b) => a.setNumber - b.setNumber);
  const setsByMatch = new Map<number, KnockoutMatchDisplay["sets"]>();
  for (const s of setRows) {
    if (!setsByMatch.has(s.matchId)) setsByMatch.set(s.matchId, []);
    setsByMatch.get(s.matchId)!.push({ winnerGames: s.winnerGames, loserGames: s.loserGames, tiebreakLoserPoints: s.tiebreakLoserPoints });
  }

  const playerIds = [...new Set(rows.flatMap((r) => [r.player1Id, r.player2Id]).filter((id): id is number => id !== null))];
  const playerRows =
    playerIds.length > 0
      ? await db.select({ id: players.id, displayName: players.displayName, country: players.country }).from(players).where(inArray(players.id, playerIds))
      : [];
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  return [...rows]
    .sort((a, b) => (SLOT_ORDER[a.slot ?? ""] ?? 0) - (SLOT_ORDER[b.slot ?? ""] ?? 0))
    .map((r) => ({
      id: r.id,
      slot: (r.slot ?? "F") as "SF1" | "SF2" | "F",
      label: SLOT_LABEL[r.slot ?? ""] ?? r.slot ?? "",
      player1: r.player1Id ? (playerById.get(r.player1Id) ?? null) : null,
      player2: r.player2Id ? (playerById.get(r.player2Id) ?? null) : null,
      winnerId: r.winnerId,
      outcome: r.outcome as KnockoutMatchDisplay["outcome"],
      sets: setsByMatch.get(r.id) ?? [],
    }));
}
