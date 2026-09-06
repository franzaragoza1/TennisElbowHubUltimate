"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminSession";
import { loadRecentResults, type LoadRecentResultsResult } from "@/lib/mana/loadRecentResults";
import { needsQueueing, queueScrapeRequest } from "@/lib/scrapeQueue";

export interface RefreshScoresOutcome {
  result: LoadRecentResultsResult | null;
  error: string | null;
  queued?: boolean;
  alreadyQueued?: boolean;
}

/** Refresca `OT_LastResults.php` en vivo — mismo límite que "Add tournament" (ver
 * `lib/mana/fetchLive.ts`): necesita un Chromium real, así que en Vercel
 * (`needsQueueing()`) se encola para el servidor casero en vez de intentarlo aquí. */
export async function refreshScoresNow(): Promise<RefreshScoresOutcome> {
  await requireAdmin();

  if (needsQueueing()) {
    const { alreadyQueued } = await queueScrapeRequest("scores", null);
    revalidatePath("/admin/scores");
    return { result: null, error: null, queued: true, alreadyQueued };
  }

  try {
    const result = await loadRecentResults();
    revalidatePath("/scores");
    revalidatePath("/admin/scores");
    return { result, error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}
