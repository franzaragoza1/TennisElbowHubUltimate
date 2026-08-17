import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { finalsEditions, finalsMatches } from "@/db/schema";
import { computeGroupStandings, sortStandings } from "./standings";
import { getGroupMatchState, getGroupParticipants } from "./queries";

async function getFinalGroupStandings(finalsEditionId: number, group: "A" | "B") {
  const [participants, { played }] = await Promise.all([
    getGroupParticipants(finalsEditionId, group),
    getGroupMatchState(finalsEditionId, group),
  ]);
  return sortStandings(computeGroupStandings(participants, played), played);
}

/**
 * Se llama tras guardar cualquier resultado de grupo. Si los dos grupos ya están
 * completos y las semifinales todavía no existen, siembra A1-B2 / B1-A2 y deja la
 * Final vacía a la espera de sus ganadoras. Idempotente: si ya hay partidos de
 * eliminatoria para esta edición, no hace nada.
 */
export async function tryAdvanceToKnockout(finalsEditionId: number): Promise<void> {
  const existingKnockout = await db
    .select({ id: finalsMatches.id })
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.stage, "semifinal")));
  if (existingKnockout.length > 0) return;

  const [groupA, groupB] = await Promise.all([
    getGroupMatchState(finalsEditionId, "A"),
    getGroupMatchState(finalsEditionId, "B"),
  ]);
  if (groupA.remainingPairs.length > 0 || groupB.remainingPairs.length > 0) return;

  const [standingsA, standingsB] = await Promise.all([
    getFinalGroupStandings(finalsEditionId, "A"),
    getFinalGroupStandings(finalsEditionId, "B"),
  ]);
  const [a1, a2] = standingsA;
  const [b1, b2] = standingsB;
  if (!a1 || !a2 || !b1 || !b2) return; // grupo con menos de 2 activos (retirada sin sustituto todavía) — no se puede sembrar

  await db.insert(finalsMatches).values([
    { finalsEditionId, stage: "semifinal", slot: "SF1", player1Id: a1.playerId, player2Id: b2.playerId, outcome: "scheduled" },
    { finalsEditionId, stage: "semifinal", slot: "SF2", player1Id: b1.playerId, player2Id: a2.playerId, outcome: "scheduled" },
    { finalsEditionId, stage: "final", slot: "F", outcome: "scheduled" },
  ]);
  await db.update(finalsEditions).set({ status: "knockout" }).where(eq(finalsEditions.id, finalsEditionId));
}

/** Se llama tras guardar el resultado de una semifinal: si las dos ya tienen ganadora, rellena los huecos de la Final. */
export async function propagateFinalWinner(finalsEditionId: number): Promise<void> {
  const sfs = await db
    .select()
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.stage, "semifinal")));
  const sf1 = sfs.find((m) => m.slot === "SF1");
  const sf2 = sfs.find((m) => m.slot === "SF2");
  if (!sf1?.winnerId || !sf2?.winnerId) return;

  await db
    .update(finalsMatches)
    .set({ player1Id: sf1.winnerId, player2Id: sf2.winnerId })
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.slot, "F")));

  const [final] = await db
    .select({ outcome: finalsMatches.outcome })
    .from(finalsMatches)
    .where(and(eq(finalsMatches.finalsEditionId, finalsEditionId), eq(finalsMatches.slot, "F")));
  if (final?.outcome === "played" || final?.outcome === "retired" || final?.outcome === "disqualified") {
    await db.update(finalsEditions).set({ status: "completed" }).where(eq(finalsEditions.id, finalsEditionId));
  }
}
