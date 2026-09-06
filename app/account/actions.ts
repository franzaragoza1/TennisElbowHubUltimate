"use server";

import { and, asc, eq, ilike, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { players, playerClaimRequests } from "@/db/schema";
import { requireUser, getLinkedPlayerId } from "@/lib/auth";
import type { AvatarOptions } from "@/lib/avatar";

export interface ClaimablePlayerRow {
  id: number;
  displayName: string;
  country: string | null;
}

/**
 * Candidatos para reclamar — cualquier `players` sin dueño y sin una solicitud
 * 'pending' ya en curso de otra persona. Sin `requireAdmin`: cualquier usuario
 * logueado puede buscar (a diferencia de app/admin/players/actions.ts::searchPlayers,
 * que es la versión de admin, sin este filtro).
 */
export async function searchClaimablePlayers(q: string): Promise<ClaimablePlayerRow[]> {
  await requireUser();
  if (q.trim().length < 2) return [];

  const pendingPlayerIds = db.select({ id: playerClaimRequests.playerId }).from(playerClaimRequests).where(eq(playerClaimRequests.status, "pending"));

  return db
    .select({ id: players.id, displayName: players.displayName, country: players.country })
    .from(players)
    .where(and(isNull(players.linkedUserId), notInArray(players.id, pendingPlayerIds), ilike(players.displayName, `%${q.trim()}%`)))
    .orderBy(asc(players.displayName))
    .limit(20);
}

/**
 * Pide vincularse a un `players` YA EXISTENTE — SIEMPRE queda 'pending' hasta que un
 * admin lo apruebe o rechace (app/admin/players/claims/actions.ts), nunca se
 * auto-aprueba (a diferencia de `createLinkedPlayer`, más abajo). Un usuario no puede
 * tener más de una solicitud pendiente ni un jugador ya vinculado a la vez —
 * comprobado aquí, no hay restricción de esquema para esto.
 */
export async function requestPlayerClaim(playerId: number): Promise<void> {
  const user = await requireUser();

  const alreadyLinked = await getLinkedPlayerId(user.id);
  if (alreadyLinked) return;

  const [existingPending] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.userId, user.id), eq(playerClaimRequests.status, "pending")));
  if (existingPending) return;

  const [target] = await db.select({ linkedUserId: players.linkedUserId }).from(players).where(eq(players.id, playerId));
  if (!target || target.linkedUserId) return;

  const [targetPending] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.playerId, playerId), eq(playerClaimRequests.status, "pending")));
  if (targetPending) return;

  await db.insert(playerClaimRequests).values({ playerId, userId: user.id, status: "pending" });
  revalidatePath("/account");
}

/**
 * Crea un `players` NUEVO y lo vincula directo — auto-aprobado, sin pasar por
 * `player_claim_requests` (pedido explícito: solo reclamar un perfil ya existente
 * necesita revisión de un admin, crear uno nuevo no).
 */
export async function createLinkedPlayer(formData: FormData): Promise<void> {
  const user = await requireUser();

  const alreadyLinked = await getLinkedPlayerId(user.id);
  if (alreadyLinked) return;
  const [existingPending] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.userId, user.id), eq(playerClaimRequests.status, "pending")));
  if (existingPending) return;

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return;
  const startYear = Number(formData.get("startYear"));
  if (!Number.isInteger(startYear)) return;

  await db.insert(players).values({ displayName, startYear, linkedUserId: user.id, avatarUrl: user.image });
  revalidatePath("/account");
}

export async function saveAvatar(options: AvatarOptions): Promise<void> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  await db
    .update(players)
    .set({ character: JSON.stringify(options) })
    .where(eq(players.id, playerId));

  revalidatePath("/rankings");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
}
