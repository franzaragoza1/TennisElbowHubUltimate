"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminSession";
import { refreshLatestRankingWeeks, type RefreshRankingsResult } from "@/lib/mana/loadRanking";

/** Botón "Refresh rankings" — mismo límite que "Add tournament"/"Refresh scores" (ver
 * `lib/mana/fetchLive.ts`): necesita un Chromium real corriendo en local, no algo que
 * una función serverless de Vercel pueda ofrecer. */
export async function refreshRankingsNow(): Promise<{ result: RefreshRankingsResult | null; error: string | null }> {
  await requireAdmin();
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
