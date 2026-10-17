"use server";

import { logAdminChange } from "@/lib/adminChangeLog";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { suggestAccountPlayerLinks, type SuggestedAccountLink } from "@/lib/adminLinkSuggestions";

export async function getSuggestedAccountLinks(): Promise<SuggestedAccountLink[]> {
  await requireAdmin();
  return suggestAccountPlayerLinks();
}

/**
 * Propone el vínculo — pone `pendingLinkUserId`, NUNCA `linkedUserId` directo (ver el
 * comentario de esa columna en db/schema.ts). Vuelve a comprobar que el jugador sigue
 * sin dueño ni otra propuesta ya en curso, mismo motivo de protección de carrera que
 * approvePlayerClaim (app/admin/players/claims/actions.ts).
 */
export async function confirmAccountLink(userId: string, playerId: number): Promise<void> {
  await requireAdmin();
  await logAdminChange("admin.players", "Linked an account to a player", { details: { userId, playerId } });
  if (!userId || !Number.isInteger(playerId)) return;

  const [target] = await db
    .select({ linkedUserId: players.linkedUserId, pendingLinkUserId: players.pendingLinkUserId })
    .from(players)
    .where(eq(players.id, playerId));
  if (!target || target.linkedUserId || target.pendingLinkUserId) return;

  await db.update(players).set({ pendingLinkUserId: userId }).where(eq(players.id, playerId));
  revalidatePath("/admin/players");
}

/** Deshace una propuesta todavía sin confirmar por el jugador — nunca toca
 * `linkedUserId` (esto solo existe mientras ese campo sigue vacío). Misma forma
 * `FormData` que unlinkPlayerAccount (app/admin/players/actions.ts), su botón
 * hermano en la misma sección "Linked account" de la ficha de admin. */
export async function cancelPendingLink(formData: FormData): Promise<void> {
  await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  if (!Number.isInteger(playerId)) return;
  await db.update(players).set({ pendingLinkUserId: null }).where(eq(players.id, playerId));
  revalidatePath("/admin/players");
}
