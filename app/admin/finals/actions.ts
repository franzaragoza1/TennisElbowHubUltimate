"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { finalsEditions, finalsMatches, finalsParticipants, finalsSets, players } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { propagateFinalWinner, tryAdvanceToKnockout } from "@/lib/finals/knockout";
import { syncMirroredMatch } from "@/lib/finals/mirror";
import { parseQuickInputBlock } from "@/lib/finals/quickInput";
import { getFinalsFormat, isCompleteMatchScore, isValidSetScore } from "@/lib/finals/format";

function seedTier(seed: number): number {
  return Math.ceil(seed / 2);
}

/** Reparto por defecto al crear la edición: separa cada pareja de seeds consecutivos
 * (1-2, 3-4, 5-6, 7-8) uno en cada grupo. El admin puede intercambiar dentro de la
 * misma pareja con `swapParticipantGroups` antes de que arranque el torneo. */
function defaultGroupForSeed(seed: number): "A" | "B" {
  return seed % 2 === 1 ? "A" : "B";
}

function roundRobinPairs(playerIds: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) pairs.push([playerIds[i], playerIds[j]]);
  }
  return pairs;
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
 * Escribe el resultado de un partido (grupo o eliminatoria) y dispara lo que dependa
 * de él: si es de grupo, comprueba si ya se puede sembrar la eliminatoria; si es una
 * semifinal, comprueba si ya se puede rellenar la Final. Punto único de escritura
 * para que `saveMatchResult`, `forceWinMatch` y `applyQuickInput` no dupliquen esta
 * lógica cada uno a su manera.
 */
async function writeMatchResult(
  matchId: number,
  winnerId: number,
  outcome: "played" | "retired" | "disqualified",
  sets: SetInput[],
): Promise<number> {
  const [match] = await db.select().from(finalsMatches).where(eq(finalsMatches.id, matchId));
  if (!match) throw new Error("Match not found");
  if (match.player1Id !== winnerId && match.player2Id !== winnerId) {
    throw new Error("Winner must be one of the two players in this match");
  }

  if (outcome === "played") {
    const [edition] = await db.select({ kind: finalsEditions.kind }).from(finalsEditions).where(eq(finalsEditions.id, match.finalsEditionId));
    const format = getFinalsFormat(edition?.kind ?? "tour_finals");
    for (const s of sets) {
      if (!isValidSetScore(s.winnerGames, s.loserGames, format)) {
        throw new Error(`Invalid set score "${s.winnerGames}-${s.loserGames}" for ${format.label} (${format.gamesPerSet}-game sets)`);
      }
    }
    if (!isCompleteMatchScore(sets, format)) {
      throw new Error(`${format.label} is best of ${format.setsToWin * 2 - 1}: the winner must take exactly ${format.setsToWin} sets to mark a match as played.`);
    }
  }

  await db.delete(finalsSets).where(eq(finalsSets.matchId, matchId));
  if (sets.length > 0) {
    await db.insert(finalsSets).values(
      sets.map((s, i) => ({
        matchId,
        setNumber: i + 1,
        winnerGames: s.winnerGames,
        loserGames: s.loserGames,
        tiebreakLoserPoints: s.tiebreakLoserPoints,
      })),
    );
  }
  await db.update(finalsMatches).set({ winnerId, outcome, playedAt: new Date() }).where(eq(finalsMatches.id, matchId));

  if (match.stage === "group") await tryAdvanceToKnockout(match.finalsEditionId);
  if (match.stage === "semifinal") await propagateFinalWinner(match.finalsEditionId);
  await syncMirroredMatch(matchId);

  revalidatePath(`/admin/finals/${match.finalsEditionId}`);
  revalidatePath(`/finals/${match.finalsEditionId}`);
  return match.finalsEditionId;
}

export async function createFinalsEdition(formData: FormData): Promise<void> {
  await requireAdmin();

  const kind = String(formData.get("kind") ?? "");
  const year = Number(formData.get("year"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!["tour_finals", "next_gen_finals"].includes(kind) || !Number.isInteger(year) || !displayName) {
    redirect("/admin/finals/new?error=missing");
  }

  // El orden en que se envían los 8 jugadores ES su seed (1º campo = seed 1, ...) —
  // el formulario los presenta ya etiquetados "Seed 1".."Seed 8".
  const playerIds = formData
    .getAll("playerId")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (playerIds.length !== 8 || new Set(playerIds).size !== 8) {
    redirect("/admin/finals/new?error=need-eight-distinct-players");
  }

  const [edition] = await db.insert(finalsEditions).values({ kind, year, displayName, status: "setup" }).returning({ id: finalsEditions.id });

  await db.insert(finalsParticipants).values(
    playerIds.map((playerId, i) => {
      const seed = i + 1;
      return { finalsEditionId: edition.id, playerId, seed, group: defaultGroupForSeed(seed), status: "active" as const };
    }),
  );

  revalidatePath("/admin/finals");
  redirect(`/admin/finals/${edition.id}`);
}

/** Solo el nombre visible es editable — `kind`/`year` son la clave única de la
 * edición (`unique(kind, year)`) y su identidad estructural, igual que un `Trn=` de
 * Mana Games nunca cambia de año una vez importado. */
export async function updateFinalsEditionInfo(formData: FormData): Promise<void> {
  await requireAdmin();
  const finalsEditionId = Number(formData.get("finalsEditionId"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!Number.isInteger(finalsEditionId) || !displayName) redirect("/admin/finals");

  await db.update(finalsEditions).set({ displayName }).where(eq(finalsEditions.id, finalsEditionId));

  revalidatePath(`/admin/finals/${finalsEditionId}`);
  revalidatePath(`/finals/${finalsEditionId}`);
  revalidatePath("/admin/finals");
  revalidatePath("/finals");
  revalidatePath("/tournaments");
}

/** Intercambia de grupo a dos jugadores del mismo escalón de seed (1-2, 3-4, 5-6,
 * 7-8), como pide el drag&drop del panel. Se devuelve el error en vez de redirigir
 * porque esta acción se llama desde un componente cliente de arrastrar y soltar, no
 * desde un <form>. */
export async function swapParticipantGroups(participantAId: number, participantBId: number): Promise<{ error: string | null }> {
  await requireAdmin();

  const rows = await db.select().from(finalsParticipants).where(inArray(finalsParticipants.id, [participantAId, participantBId]));
  const a = rows.find((r) => r.id === participantAId);
  const b = rows.find((r) => r.id === participantBId);
  if (!a || !b) return { error: "Participant not found" };
  if (a.finalsEditionId !== b.finalsEditionId) return { error: "Participants belong to different editions" };
  if (seedTier(a.seed) !== seedTier(b.seed)) return { error: "Only players in the same seeding tier can be swapped" };
  if (a.group === b.group) return { error: "Already in the same group" };

  const [edition] = await db.select({ status: finalsEditions.status }).from(finalsEditions).where(eq(finalsEditions.id, a.finalsEditionId));
  if (edition?.status !== "setup") return { error: "Groups are locked once the tournament has started" };

  await db.update(finalsParticipants).set({ group: a.group }).where(eq(finalsParticipants.id, b.id));
  await db.update(finalsParticipants).set({ group: b.group }).where(eq(finalsParticipants.id, a.id));

  revalidatePath(`/admin/finals/${a.finalsEditionId}`);
  return { error: null };
}

/** Cierra la asignación de grupos, genera los 6 cruces de round robin de cada grupo
 * y pasa la edición a 'groups'. A partir de aquí `swapParticipantGroups` ya no deja
 * mover a nadie (comprueba `status === 'setup'`). */
export async function startGroupStage(formData: FormData): Promise<void> {
  await requireAdmin();
  const finalsEditionId = Number(formData.get("finalsEditionId"));
  if (!Number.isInteger(finalsEditionId)) redirect("/admin/finals");

  const [edition] = await db.select().from(finalsEditions).where(eq(finalsEditions.id, finalsEditionId));
  if (!edition || edition.status !== "setup") redirect(`/admin/finals/${finalsEditionId}`);

  const participants = await db
    .select()
    .from(finalsParticipants)
    .where(and(eq(finalsParticipants.finalsEditionId, finalsEditionId), eq(finalsParticipants.status, "active")));
  const groupA = participants.filter((p) => p.group === "A").map((p) => p.playerId);
  const groupB = participants.filter((p) => p.group === "B").map((p) => p.playerId);
  if (groupA.length !== 4 || groupB.length !== 4) redirect(`/admin/finals/${finalsEditionId}?error=groups-incomplete`);

  const fixtures = [
    ...roundRobinPairs(groupA).map(([player1Id, player2Id]) => ({ group: "A" as const, player1Id, player2Id })),
    ...roundRobinPairs(groupB).map(([player1Id, player2Id]) => ({ group: "B" as const, player1Id, player2Id })),
  ];
  await db.insert(finalsMatches).values(
    fixtures.map((f) => ({ finalsEditionId, stage: "group" as const, group: f.group, player1Id: f.player1Id, player2Id: f.player2Id, outcome: "scheduled" as const })),
  );
  await db.update(finalsEditions).set({ status: "groups" }).where(eq(finalsEditions.id, finalsEditionId));

  revalidatePath(`/admin/finals/${finalsEditionId}`);
  revalidatePath(`/finals/${finalsEditionId}`);
}

/** Resultado normal, introducido set a set. */
export async function saveMatchResult(formData: FormData): Promise<void> {
  await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const winnerId = Number(formData.get("winnerId"));
  const sets = formData
    .getAll("set")
    .map((raw) => parseSetInput(String(raw)))
    .filter((s): s is SetInput => s !== null);
  if (sets.length === 0) redirect(`/admin/finals?error=no-sets`);

  await writeMatchResult(matchId, winnerId, "played", sets);
}

/** "Force Win": cierra un partido de un jugador retirado sin exigir un marcador
 * completo. El marcador parcial que ya se hubiera introducido (p.ej. 6-4 1-1) se
 * conserva tal cual, no se toca. */
export async function forceWinMatch(formData: FormData): Promise<void> {
  await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const winnerId = Number(formData.get("winnerId"));

  const [match] = await db.select().from(finalsMatches).where(eq(finalsMatches.id, matchId));
  if (!match) redirect("/admin/finals");
  if (match.player1Id !== winnerId && match.player2Id !== winnerId) redirect(`/admin/finals/${match.finalsEditionId}?error=invalid-winner`);

  await db.update(finalsMatches).set({ winnerId, outcome: "retired", playedAt: new Date() }).where(eq(finalsMatches.id, matchId));
  if (match.stage === "group") await tryAdvanceToKnockout(match.finalsEditionId);
  if (match.stage === "semifinal") await propagateFinalWinner(match.finalsEditionId);
  await syncMirroredMatch(matchId);

  revalidatePath(`/admin/finals/${match.finalsEditionId}`);
  revalidatePath(`/finals/${match.finalsEditionId}`);
}

function resolveParticipant(
  name: string,
  participants: { playerId: number; displayName: string }[],
): { playerId: number; displayName: string } | null {
  const lower = name.trim().toLowerCase();
  const exact = participants.find((p) => p.displayName.toLowerCase() === lower);
  if (exact) return exact;
  const partial = participants.filter((p) => p.displayName.toLowerCase().includes(lower) || lower.includes(p.displayName.toLowerCase()));
  return partial.length === 1 ? partial[0] : null; // ambiguo o sin match: se deja para que el admin lo resuelva a mano
}

export interface QuickInputLineOutcome {
  lineNumber: number;
  raw: string;
  error: string | null;
}

/** Pega el textarea de "Player1 def. Player2 6/4 6/1", resuelve cada nombre contra
 * el roster de esta edición y aplica el resultado sobre el cruce programado que le
 * corresponda. Una línea que falle no bloquea al resto — se informa línea a línea. */
export async function applyQuickInput(finalsEditionId: number, text: string): Promise<QuickInputLineOutcome[]> {
  await requireAdmin();

  const lines = parseQuickInputBlock(text);
  const participants = await db
    .select({ playerId: finalsParticipants.playerId, displayName: players.displayName })
    .from(finalsParticipants)
    .innerJoin(players, eq(players.id, finalsParticipants.playerId))
    .where(and(eq(finalsParticipants.finalsEditionId, finalsEditionId), eq(finalsParticipants.status, "active")));
  const scheduled = await db
    .select()
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.outcome, "scheduled")));

  const results: QuickInputLineOutcome[] = [];
  for (const line of lines) {
    if (!line.parsed) {
      results.push({ lineNumber: line.lineNumber, raw: line.raw, error: line.error });
      continue;
    }

    const winner = resolveParticipant(line.parsed.winnerName, participants);
    const loser = resolveParticipant(line.parsed.loserName, participants);
    if (!winner || !loser) {
      results.push({ lineNumber: line.lineNumber, raw: line.raw, error: "Could not match a player name to this edition's roster" });
      continue;
    }

    const match = scheduled.find(
      (m) => (m.player1Id === winner.playerId && m.player2Id === loser.playerId) || (m.player1Id === loser.playerId && m.player2Id === winner.playerId),
    );
    if (!match) {
      results.push({ lineNumber: line.lineNumber, raw: line.raw, error: "No scheduled match between these two players" });
      continue;
    }

    try {
      await writeMatchResult(match.id, winner.playerId, line.parsed.outcome === "walkover" ? "retired" : line.parsed.outcome, line.parsed.sets);
      results.push({ lineNumber: line.lineNumber, raw: line.raw, error: null });
    } catch (e) {
      results.push({ lineNumber: line.lineNumber, raw: line.raw, error: e instanceof Error ? e.message : "Failed to save" });
    }
  }
  return results;
}

/** Sustituye a un jugador retirado por su suplente. Solo reescribe los cruces
 * TODAVÍA NO JUGADOS: un partido ya jugado se queda como está, es historia real del
 * jugador retirado, no del suplente. */
export async function substituteAlternate(formData: FormData): Promise<void> {
  await requireAdmin();
  const participantId = Number(formData.get("participantId"));
  const alternatePlayerId = Number(formData.get("alternatePlayerId"));

  const [original] = await db.select().from(finalsParticipants).where(eq(finalsParticipants.id, participantId));
  if (!original) redirect("/admin/finals");

  await db.update(finalsParticipants).set({ status: "withdrawn" }).where(eq(finalsParticipants.id, participantId));
  await db.insert(finalsParticipants).values({
    finalsEditionId: original.finalsEditionId,
    playerId: alternatePlayerId,
    seed: original.seed,
    group: original.group,
    status: "active",
    replacesParticipantId: original.id,
  });

  await db
    .update(finalsMatches)
    .set({ player1Id: alternatePlayerId })
    .where(and(eq(finalsMatches.finalsEditionId, original.finalsEditionId), eq(finalsMatches.player1Id, original.playerId), eq(finalsMatches.outcome, "scheduled")));
  await db
    .update(finalsMatches)
    .set({ player2Id: alternatePlayerId })
    .where(and(eq(finalsMatches.finalsEditionId, original.finalsEditionId), eq(finalsMatches.player2Id, original.playerId), eq(finalsMatches.outcome, "scheduled")));

  revalidatePath(`/admin/finals/${original.finalsEditionId}`);
  revalidatePath(`/finals/${original.finalsEditionId}`);
}
