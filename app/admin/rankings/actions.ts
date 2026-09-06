"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminSession";
import { refreshLatestRankingWeeks, type RefreshRankingsResult } from "@/lib/mana/loadRanking";
import { needsQueueing, queueScrapeRequest } from "@/lib/scrapeQueue";

export interface RefreshRankingsOutcome {
  result: RefreshRankingsResult | null;
  error: string | null;
  queued?: boolean;
  alreadyQueued?: boolean;
}

/** Botón "Refresh rankings" — mismo límite que "Add tournament"/"Refresh scores" (ver
 * `lib/mana/fetchLive.ts`): necesita un Chromium real, así que en Vercel
 * (`needsQueueing()`) se encola para que `scripts/autoScrape.ts` lo ejecute en el
 * servidor casero en su siguiente pasada, en vez de intentarlo aquí mismo. */
export async function refreshRankingsNow(): Promise<RefreshRankingsOutcome> {
  await requireAdmin();

  if (needsQueueing()) {
    const { alreadyQueued } = await queueScrapeRequest("ranking", null);
    revalidatePath("/admin/rankings");
    return { result: null, error: null, queued: true, alreadyQueued };
  }

  try {
    const result = await refreshLatestRankingWeeks();
    if (result.officialWeeksLoaded.length > 0 || result.raceWeeksLoaded.length > 0) {
      revalidatePath("/rankings");
      revalidatePath("/");
      revalidatePath("/players");
      revalidatePath("/h2h");
    }
    revalidatePath("/admin/rankings");
    return { result, error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}
