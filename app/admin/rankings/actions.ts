"use server";

import { revalidatePath, updateTag } from "next/cache";
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
 * `lib/mana/fetchLive.ts`): necesita un Chromium real, así que en Render
 * (`needsQueueing()`) se encola para que `scripts/autoScrape.ts` lo ejecute en el
 * servidor siempre-vivo en su siguiente pasada, en vez de intentarlo aquí mismo. */
export async function refreshRankingsNow(): Promise<RefreshRankingsOutcome> {
  await requireAdmin();

  if (needsQueueing()) {
    const { alreadyQueued } = await queueScrapeRequest("ranking", null);
    revalidatePath("/account");
    return { result: null, error: null, queued: true, alreadyQueued };
  }

  try {
    const result = await refreshLatestRankingWeeks();
    if (result.officialWeeksLoaded.length > 0 || result.raceWeeksLoaded.length > 0) {
      revalidatePath("/rankings");
      revalidatePath("/");
      revalidatePath("/players");
      revalidatePath("/h2h");
      // Ver el comentario en app/api/scraper/revalidate/route.ts — `revalidatePath`
      // sobre `/rankings` no cubre de forma fiable el `unstable_cache` propio del
      // widget del sidebar (RankingsWidget.tsx sale en páginas que no son `/rankings`),
      // así que hace falta la etiqueta explícita aparte. `updateTag`, no
      // `revalidateTag`: esto SÍ corre dentro de una Server Action (este fichero es
      // "use server"), así que Next.js soporta la expiración inmediata de verdad en
      // vez de solo programar una revalidación en segundo plano.
      updateTag("rankings");
    }
    revalidatePath("/account");
    return { result, error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}
