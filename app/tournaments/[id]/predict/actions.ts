"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { bracketPredictions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { buildBracketLayout } from "@/lib/bracket";
import { excludeQualifyingRounds, getBracketMatchesForEdition } from "@/lib/tournamentBracketData";
import { isPredictionEligible, getPredictionLockInfo } from "@/lib/predictions/queries";
import { validateBracketPicks } from "@/lib/predictions/validatePicks";
import type { BracketPick } from "@/lib/predictions/scoring";

export interface SubmitPredictionOutcome {
  error: string | null;
}

export async function submitPrediction(editionId: number, picks: BracketPick[]): Promise<SubmitPredictionOutcome> {
  const user = await requireUser();

  const [eligible, lockInfo] = await Promise.all([isPredictionEligible(editionId), getPredictionLockInfo(editionId)]);
  if (!eligible) return { error: "Predictions aren't open for this tournament." };
  if (lockInfo.locked) return { error: "Predictions for this tournament are locked — the first round is over, or the second round has started." };

  const layout = buildBracketLayout(excludeQualifyingRounds(await getBracketMatchesForEdition(editionId)));
  const validation = validateBracketPicks(picks, layout);
  if (!validation.valid) return { error: "That bracket isn't consistent — try filling it out again from the start." };

  await db
    .insert(bracketPredictions)
    .values({ editionId, userId: user.id, picks })
    .onConflictDoUpdate({ target: [bracketPredictions.editionId, bracketPredictions.userId], set: { picks, submittedAt: new Date() } });

  revalidatePath(`/tournaments/${editionId}/predict`);
  return { error: null };
}
