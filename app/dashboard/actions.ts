"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { getSessionPlayerId, clearSession } from "@/lib/session";
import type { AvatarOptions } from "@/lib/avatar";

export async function saveAvatar(options: AvatarOptions) {
  const playerId = await getSessionPlayerId();
  if (!playerId) redirect("/login");

  await db
    .update(players)
    .set({ character: JSON.stringify(options) })
    .where(eq(players.id, playerId));

  revalidatePath("/rankings");
  revalidatePath(`/players/${playerId}`);
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
