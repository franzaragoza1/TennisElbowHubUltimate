"use server";

import { eq, ilike, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { editions, events, matches, matchVideos, players } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { syncChannelVideos, type SyncResult } from "@/lib/youtube/sync";
import { compareByRoundProgression } from "@/lib/roundOrder";

export async function syncVideosNow(): Promise<{ result: SyncResult | null; error: string | null }> {
  await requireAdmin();
  try {
    const result = await syncChannelVideos();
    revalidatePath("/admin/videos");
    return { result, error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Sync failed" };
  }
}

export interface MatchCandidateOption {
  id: number;
  label: string;
}

function matchLabelSelection() {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  return {
    p1,
    p2,
    columns: {
      id: matches.id,
      round: matches.round,
      player1: p1.displayName,
      player2: p2.displayName,
      eventName: events.displayName,
      year: editions.year,
    },
  };
}

/** Las opciones exactas para un vídeo 'pending': los partidos que el emparejador ya
 * identificó como los únicos jugados entre los dos rivales del título — nunca una
 * lista más amplia. */
export async function getMatchLabels(matchIds: number[]): Promise<MatchCandidateOption[]> {
  await requireAdmin();
  if (matchIds.length === 0) return [];

  const { p1, p2, columns } = matchLabelSelection();
  const rows = await db
    .select(columns)
    .from(matches)
    .innerJoin(editions, eq(matches.editionId, editions.id))
    .innerJoin(events, eq(editions.eventId, events.id))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(inArray(matches.id, matchIds));

  return rows.map((r) => ({ id: r.id, label: `${r.player1} vs ${r.player2} — ${r.eventName} ${r.year} (${r.round})` }));
}

/** Solo para el puñado de vídeos sin ni siquiera una propuesta (el emparejador no
 * resolvió a dos jugadores, o esos dos jugadores nunca se han cruzado) — ahí sí hace
 * falta un buscador abierto, porque no hay ninguna lista de candidatos que ofrecer. */
export async function searchMatchCandidates(query: string): Promise<MatchCandidateOption[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const { p1, p2, columns } = matchLabelSelection();
  const like = `%${q}%`;
  const rows = await db
    .select(columns)
    .from(matches)
    .innerJoin(editions, eq(matches.editionId, editions.id))
    .innerJoin(events, eq(editions.eventId, events.id))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(or(ilike(p1.displayName, like), ilike(p2.displayName, like), ilike(events.displayName, like)))
    .limit(8);

  return rows.map((r) => ({ id: r.id, label: `${r.player1} vs ${r.player2} — ${r.eventName} ${r.year} (${r.round})` }));
}

export interface EditionOption {
  id: number;
  label: string;
}

/** Para "elegir el partido navegando por torneos": busca la edición (torneo + año)
 * cuando el emparejador no propuso nada usable — el admin sabe qué torneo era aunque
 * no recuerde cómo se escribe el nombre del jugador en la base de datos. */
export async function searchEditionsForBrowse(query: string): Promise<EditionOption[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await db
    .select({ id: editions.id, eventName: events.displayName, year: editions.year, isoWeek: editions.isoWeek })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(ilike(events.displayName, `%${q}%`))
    .orderBy(events.displayName)
    .limit(10);

  return rows.map((r) => ({
    id: r.id,
    label: `${r.eventName} ${r.year}${r.isoWeek ? ` · Week ${r.isoWeek}` : ""}`,
  }));
}

/** Segundo paso del navegador: todos los partidos de la edición elegida, para
 * clicar directamente el que corresponde al vídeo. */
export async function getMatchesForEditionBrowse(editionId: number): Promise<MatchCandidateOption[]> {
  await requireAdmin();
  if (!Number.isInteger(editionId)) return [];

  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const rows = await db
    .select({ id: matches.id, round: matches.round, player1: p1.displayName, player2: p2.displayName })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(eq(matches.editionId, editionId));

  return rows
    .sort((a, b) => compareByRoundProgression(a.round, b.round))
    .map((r) => ({ id: r.id, label: `${r.round} — ${r.player1} vs ${r.player2}` }));
}

export async function confirmMatchVideo(formData: FormData): Promise<void> {
  await requireAdmin();
  const videoId = Number(formData.get("videoId"));
  const matchId = Number(formData.get("matchId"));
  if (!Number.isInteger(videoId) || !Number.isInteger(matchId)) return;

  await db.update(matchVideos).set({ matchId, status: "confirmed" }).where(eq(matchVideos.id, videoId));
  revalidatePath("/admin/videos");
  revalidatePath("/tournaments");
}

export async function rejectMatchVideo(formData: FormData): Promise<void> {
  await requireAdmin();
  const videoId = Number(formData.get("videoId"));
  if (!Number.isInteger(videoId)) return;

  await db.update(matchVideos).set({ status: "rejected", matchId: null }).where(eq(matchVideos.id, videoId));
  revalidatePath("/admin/videos");
}
