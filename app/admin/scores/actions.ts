"use server";

import { logAdminChange, formDetails } from "@/lib/adminChangeLog";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { liveScoresCache, recentResults } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { buildFakeLiveMatch, FAKE_LIVE_MATCH_TOURNAMENT_NAME } from "@/lib/liveTennis/fakeLiveMatch";
import type { LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";
import { loadRecentResults, type LoadRecentResultsResult } from "@/lib/mana/loadRecentResults";
import { needsQueueing, queueScrapeRequest } from "@/lib/scrapeQueue";

const LIVE_CACHE_ROW_ID = 1;

export interface RefreshScoresOutcome {
  result: LoadRecentResultsResult | null;
  error: string | null;
  queued?: boolean;
  alreadyQueued?: boolean;
}

/** Refresca `OT_LastResults.php` en vivo — mismo límite que "Add tournament" (ver
 * `lib/mana/fetchLive.ts`): necesita un Chromium real, así que en Render
 * (`needsQueueing()`) se encola para el servidor siempre-vivo en vez de intentarlo
 * aquí. */
export async function refreshScoresNow(): Promise<RefreshScoresOutcome> {
  await requireAdmin();

  if (needsQueueing()) {
    const { alreadyQueued } = await queueScrapeRequest("scores", null);
    revalidatePath("/account");
    return { result: null, error: null, queued: true, alreadyQueued };
  }

  try {
    const result = await loadRecentResults();
    revalidatePath("/scores");
    revalidatePath("/account");
    return { result, error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}

/**
 * Borra un resultado reportado por error de `recent_results` (y sus sets, en cascada,
 * ver db/schema.ts) — pedido explícito del propietario, 2026-09-27, tras un walkover
 * mal reportado (Franky Franchicha b. hrvoje996) que `/void-match` no podía arreglar:
 * ese comando solo toca el hilo de organización de Discord, nunca los resultados. Esto
 * SOLO quita el resultado de la ficha "recently reported"/`/scores` de nuestro sitio —
 * nunca toca `OT_LastResults.php` en Mana Games ni el cuadro real del torneo
 * (`matches`), así que si Mana sigue enseñando el mismo resultado, el próximo
 * `refreshScoresNow`/scrape automático puede volver a traerlo. Corregirlo de verdad
 * para siempre exige que también se corrija en Mana Games.
 */
export async function voidRecentResult(formData: FormData): Promise<void> {
  await requireAdmin();
  await logAdminChange("admin.scores", "Hid a recent result", { details: formDetails(formData) });
  const resultId = Number(formData.get("resultId"));
  if (!Number.isInteger(resultId)) return;

  await db.delete(recentResults).where(eq(recentResults.id, resultId));

  revalidatePath("/scores");
  revalidatePath("/account");
}

/**
 * Herramienta de solo pruebas: inyecta/quita un partido de mentira en
 * `live_scores_cache` para ver la tira de "Live Now" sin esperar a un partido real ni
 * levantar scripts/liveScoresSync.ts en local. Filtra siempre el partido de pega
 * anterior antes de decidir (por `tournamentName`, ver lib/liveTennis/fakeLiveMatch.ts)
 * y conserva cualquier partido real que ya hubiera en la fila — así encender/apagar
 * esto nunca pisa datos de verdad si el sync sí está corriendo.
 */
export async function toggleFakeLiveMatch(enable: boolean): Promise<void> {
  await requireAdmin();

  const [row] = await db.select({ matches: liveScoresCache.matches }).from(liveScoresCache).where(eq(liveScoresCache.id, LIVE_CACHE_ROW_ID));
  const realMatches = ((row?.matches ?? []) as LiveTourMatch[]).filter((m) => m.tournamentName !== FAKE_LIVE_MATCH_TOURNAMENT_NAME);
  const matches = enable ? [...realMatches, buildFakeLiveMatch()] : realMatches;

  await db
    .insert(liveScoresCache)
    .values({ id: LIVE_CACHE_ROW_ID, matches })
    .onConflictDoUpdate({ target: liveScoresCache.id, set: { matches, updatedAt: new Date() } });

  revalidatePath("/account");
}
