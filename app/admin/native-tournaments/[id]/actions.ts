"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { byes, editions, events, matches, nativeTournamentRegistrations, pendingSlots, players, sets as setsTable } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { fullRoundLadder } from "@/lib/bracket";
import { placeSeedsIntoBracket } from "@/lib/nativeTournaments/seeding";
import { isCompleteMatchScore, isValidSetScore, STANDARD_FORMAT } from "@/lib/tennisScore";
import { deriveTournamentStatus } from "@/lib/tournamentStatus";
import { getBracketMatchesForEdition, getDecidablePendingSlots } from "@/lib/tournamentBracketData";

export interface NativeTournamentActionOutcome {
  error: string | null;
}

export async function registerPlayer(formData: FormData): Promise<NativeTournamentActionOutcome> {
  await requireAdmin();
  const editionId = Number(formData.get("editionId"));
  const playerId = Number(formData.get("playerId"));
  const seedRaw = String(formData.get("seed") ?? "").trim();
  if (!Number.isInteger(editionId) || !Number.isInteger(playerId)) return { error: "Invalid player or tournament." };

  await db
    .insert(nativeTournamentRegistrations)
    .values({ editionId, playerId, seed: seedRaw ? Number(seedRaw) : null, status: "registered" })
    .onConflictDoUpdate({
      target: [nativeTournamentRegistrations.editionId, nativeTournamentRegistrations.playerId],
      set: { status: "registered", seed: seedRaw ? Number(seedRaw) : null },
    });

  revalidatePath("/account");
  return { error: null };
}

export async function withdrawRegistration(formData: FormData): Promise<NativeTournamentActionOutcome> {
  await requireAdmin();
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(registrationId)) return { error: "Invalid registration." };

  await db.delete(nativeTournamentRegistrations).where(eq(nativeTournamentRegistrations.id, registrationId));
  revalidatePath("/account");
  return { error: null };
}

/**
 * Genera la primera ronda a partir de los inscritos (lib/nativeTournaments/seeding.ts,
 * siembra estándar + byes a los mejores seeds) y deja el resto del cuadro como huecos
 * `pendingSlots` — TBD salvo la SEGUNDA ronda, que ya puede tener un lado relleno si
 * viene de un bye de la primera (un bye avanza solo, sin esperar a que el admin
 * "juegue" nada). Rondas más allá de la segunda nunca pueden tener esto: un bye solo
 * existe en la primera ronda (hueco de cuadro sin inscrito, no una regla que se
 * repita ronda a ronda).
 */
export async function generateDraw(formData: FormData): Promise<NativeTournamentActionOutcome> {
  await requireAdmin();
  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId)) return { error: "Invalid tournament." };

  const [edition] = await db.select({ drawSize: editions.drawSize }).from(editions).where(eq(editions.id, editionId));
  if (!edition) return { error: "Tournament not found." };

  const registrations = await db
    .select({ playerId: nativeTournamentRegistrations.playerId, seed: nativeTournamentRegistrations.seed })
    .from(nativeTournamentRegistrations)
    .where(and(eq(nativeTournamentRegistrations.editionId, editionId), eq(nativeTournamentRegistrations.status, "registered")))
    .orderBy(asc(nativeTournamentRegistrations.registeredAt));

  let placement;
  try {
    placement = placeSeedsIntoBracket(registrations, edition.drawSize);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Seeding failed." };
  }
  const seedByPlayer = new Map(registrations.map((r) => [r.playerId, r.seed]));

  const ladder = fullRoundLadder(edition.drawSize);
  const firstRound = ladder[0];

  if (placement.byes.length > 0) {
    await db.insert(byes).values(
      placement.byes.map((b) => ({ editionId, round: firstRound, playerId: b.playerId, seed: seedByPlayer.get(b.playerId) ?? null, sortIndex: b.slotIndex })),
    );
  }
  if (placement.matches.length > 0) {
    await db.insert(pendingSlots).values(
      placement.matches.map((m) => ({
        editionId,
        round: firstRound,
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        player1Seed: seedByPlayer.get(m.player1Id) ?? null,
        player2Seed: seedByPlayer.get(m.player2Id) ?? null,
        sortIndex: m.slotIndex,
      })),
    );
  }

  for (let i = 1; i < ladder.length; i++) {
    const round = ladder[i];
    const slotCount = edition.drawSize / 2 ** (i + 1);
    const rows = Array.from({ length: slotCount }, (_, sortIndex) => {
      if (i !== 1) return { editionId, round, player1Id: null, player2Id: null, player1Seed: null, player2Seed: null, sortIndex };
      const bye0 = placement.byes.find((b) => b.slotIndex === sortIndex * 2);
      const bye1 = placement.byes.find((b) => b.slotIndex === sortIndex * 2 + 1);
      return {
        editionId,
        round,
        player1Id: bye0?.playerId ?? null,
        player2Id: bye1?.playerId ?? null,
        player1Seed: bye0 ? (seedByPlayer.get(bye0.playerId) ?? null) : null,
        player2Seed: bye1 ? (seedByPlayer.get(bye1.playerId) ?? null) : null,
        sortIndex,
      };
    });
    await db.insert(pendingSlots).values(rows);
  }

  revalidatePath("/account");
  revalidatePath(`/tournaments/${editionId}`);
  revalidatePath("/tournaments");
  return { error: null };
}

interface SetInput {
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

function parseSetInput(raw: string): SetInput | null {
  const m = /^(\d{1,2})[/-](\d{1,2})(?:\((\d{1,2})\))?$/.exec(raw.trim());
  if (!m) return null;
  return { winnerGames: Number(m[1]), loserGames: Number(m[2]), tiebreakLoserPoints: m[3] ? Number(m[3]) : null };
}

/**
 * Decide un cruce (`pendingSlots` -> fila real en `matches`/`sets`) y propaga al
 * ganador al hueco que le toque en la ronda siguiente — el hueco K de una ronda sale
 * de los huecos 2K y 2K+1 de la ronda anterior (misma convención que
 * lib/bracket.ts::buildBracketLayout, aquí aplicada hacia ADELANTE en vez de
 * reconstruida hacia atrás). La ronda siguiente ya existe siempre como
 * `pendingSlots` (generateDraw la crea entera de antemano), así que esto solo
 * actualiza, nunca inserta una ronda nueva.
 */
export async function recordMatchResult(formData: FormData): Promise<NativeTournamentActionOutcome> {
  await requireAdmin();
  const pendingSlotId = Number(formData.get("pendingSlotId"));
  const winnerId = Number(formData.get("winnerId"));
  const outcome = String(formData.get("outcome") ?? "played");
  if (!["played", "walkover", "retired", "disqualified"].includes(outcome)) return { error: "Invalid outcome." };

  const [slot] = await db.select().from(pendingSlots).where(eq(pendingSlots.id, pendingSlotId));
  if (!slot) return { error: "Match slot not found." };
  if (slot.player1Id === null || slot.player2Id === null) return { error: "Both players must be known before entering a result." };
  if (winnerId !== slot.player1Id && winnerId !== slot.player2Id) return { error: "Winner must be one of the two players in this match." };

  let parsedSets: SetInput[] = [];
  if (outcome === "played") {
    parsedSets = formData
      .getAll("set")
      .map((raw) => parseSetInput(String(raw)))
      .filter((s): s is SetInput => s !== null);
    for (const s of parsedSets) {
      if (!isValidSetScore(s.winnerGames, s.loserGames, STANDARD_FORMAT)) {
        return { error: `Invalid set score "${s.winnerGames}-${s.loserGames}".` };
      }
    }
    if (!isCompleteMatchScore(parsedSets, STANDARD_FORMAT)) {
      return { error: "The winner must take exactly 2 sets to mark a match as played." };
    }
  }

  const scoreRaw = parsedSets.map((s) => `${s.winnerGames}-${s.loserGames}${s.tiebreakLoserPoints !== null ? `(${s.tiebreakLoserPoints})` : ""}`).join(" ");
  const [match] = await db
    .insert(matches)
    .values({
      editionId: slot.editionId,
      round: slot.round,
      player1Id: slot.player1Id,
      player2Id: slot.player2Id,
      player1Seed: slot.player1Seed,
      player2Seed: slot.player2Seed,
      winnerId,
      outcome: outcome as "played" | "walkover" | "retired" | "disqualified",
      scoreRaw: scoreRaw || null,
      playedAt: new Date(),
      sortIndex: slot.sortIndex,
    })
    .returning({ id: matches.id });

  if (parsedSets.length > 0) {
    await db.insert(setsTable).values(parsedSets.map((s, i) => ({ matchId: match.id, setNumber: i + 1, ...s })));
  }
  await db.delete(pendingSlots).where(eq(pendingSlots.id, pendingSlotId));

  const [edition] = await db.select({ drawSize: editions.drawSize }).from(editions).where(eq(editions.id, slot.editionId));
  const ladder = fullRoundLadder(edition!.drawSize);
  const roundIdx = ladder.indexOf(slot.round);
  if (roundIdx !== -1 && roundIdx < ladder.length - 1) {
    const nextRound = ladder[roundIdx + 1];
    const nextSortIndex = Math.floor(slot.sortIndex / 2);
    const winnerSeed = winnerId === slot.player1Id ? slot.player1Seed : slot.player2Seed;
    const isFirstFeeder = slot.sortIndex % 2 === 0;

    const [nextSlot] = await db
      .select()
      .from(pendingSlots)
      .where(and(eq(pendingSlots.editionId, slot.editionId), eq(pendingSlots.round, nextRound), eq(pendingSlots.sortIndex, nextSortIndex)));
    if (nextSlot) {
      await db
        .update(pendingSlots)
        .set(isFirstFeeder ? { player1Id: winnerId, player1Seed: winnerSeed } : { player2Id: winnerId, player2Seed: winnerSeed })
        .where(eq(pendingSlots.id, nextSlot.id));
    }
  }

  revalidatePath("/account");
  revalidatePath(`/tournaments/${slot.editionId}`);
  revalidatePath("/tournaments");
  return { error: null };
}

export interface NativeTournamentDetail {
  id: number;
  eventName: string;
  year: number;
  category: string;
  drawSize: number;
  status: ReturnType<typeof deriveTournamentStatus>;
  hasDraw: boolean;
  registrations: { registrationId: number; playerId: number; displayName: string; seed: number | null }[];
  bracketMatches: Awaited<ReturnType<typeof getBracketMatchesForEdition>>;
  decidable: Awaited<ReturnType<typeof getDecidablePendingSlots>>;
}

/** Antes app/admin/(panel)/native-tournaments/[id]/page.tsx. */
export async function getNativeTournamentDetail(editionId: number): Promise<NativeTournamentDetail | null> {
  await requireAdmin();
  if (!Number.isInteger(editionId)) return null;

  const [edition] = await db
    .select({ id: editions.id, eventName: events.displayName, year: editions.year, category: editions.category, drawSize: editions.drawSize })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(eq(editions.id, editionId));
  if (!edition) return null;

  const registrations = await db
    .select({
      registrationId: nativeTournamentRegistrations.id,
      playerId: players.id,
      displayName: players.displayName,
      seed: nativeTournamentRegistrations.seed,
    })
    .from(nativeTournamentRegistrations)
    .innerJoin(players, eq(players.id, nativeTournamentRegistrations.playerId))
    .where(eq(nativeTournamentRegistrations.editionId, editionId));

  const bracketMatches = await getBracketMatchesForEdition(editionId);
  const hasDraw = bracketMatches.length > 0;
  const status = deriveTournamentStatus(bracketMatches.filter((m) => m.outcome !== "bye" && m.outcome !== "pending"), hasDraw);
  const decidable = hasDraw ? await getDecidablePendingSlots(editionId) : [];

  return {
    id: edition.id,
    eventName: edition.eventName,
    year: edition.year,
    category: edition.category,
    drawSize: edition.drawSize,
    status,
    hasDraw,
    registrations,
    bracketMatches,
    decidable,
  };
}
