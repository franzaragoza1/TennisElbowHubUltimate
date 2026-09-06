"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { players, playerClaimRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";

/**
 * Aprueba una solicitud pendiente — vuelve a comprobar que el jugador sigue sin
 * dueño antes de vincular (protección de carrera: dos claims 'pending' sobre el
 * mismo jugador no deberían poder existir por app/account/actions.ts::
 * requestPlayerClaim, pero si pasara, esto evita que el segundo "gane" sobre un
 * jugador ya vinculado por el primero).
 */
export async function approvePlayerClaim(formData: FormData): Promise<void> {
  await requireAdmin();
  const claimId = Number(formData.get("claimId"));
  if (!Number.isInteger(claimId)) return;

  const [claim] = await db.select().from(playerClaimRequests).where(eq(playerClaimRequests.id, claimId));
  if (!claim || claim.status !== "pending") return;

  const [target] = await db.select({ linkedUserId: players.linkedUserId }).from(players).where(eq(players.id, claim.playerId));
  if (!target || target.linkedUserId) {
    await db.update(playerClaimRequests).set({ status: "rejected", decidedAt: new Date() }).where(eq(playerClaimRequests.id, claimId));
    revalidatePath("/admin/players/claims");
    return;
  }

  await db.update(players).set({ linkedUserId: claim.userId }).where(eq(players.id, claim.playerId));
  await db.update(playerClaimRequests).set({ status: "approved", decidedAt: new Date() }).where(eq(playerClaimRequests.id, claimId));

  revalidatePath("/admin/players/claims");
  revalidatePath(`/players/${claim.playerId}`);
}

export async function rejectPlayerClaim(formData: FormData): Promise<void> {
  await requireAdmin();
  const claimId = Number(formData.get("claimId"));
  if (!Number.isInteger(claimId)) return;
  await db.update(playerClaimRequests).set({ status: "rejected", decidedAt: new Date() }).where(eq(playerClaimRequests.id, claimId));
  revalidatePath("/admin/players/claims");
}
