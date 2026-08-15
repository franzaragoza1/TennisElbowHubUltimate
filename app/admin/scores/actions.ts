"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminSession";
import { loadRecentResults, type LoadRecentResultsResult } from "@/lib/mana/loadRecentResults";

/** Refresca `OT_LastResults.php` en vivo — mismo límite que "Add tournament" (ver
 * `lib/mana/fetchLive.ts`): necesita un Chromium real corriendo en local, no algo que
 * una función serverless de Vercel pueda ofrecer. */
export async function refreshScoresNow(): Promise<{ result: LoadRecentResultsResult | null; error: string | null }> {
  await requireAdmin();
  try {
    const result = await loadRecentResults();
    revalidatePath("/scores");
    revalidatePath("/admin/scores");
    return { result, error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}
