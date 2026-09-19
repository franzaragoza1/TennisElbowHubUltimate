"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { follows } from "@/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { isFollowing, type FollowTargetType } from "@/lib/follows";

export interface ToggleFollowOutcome {
  following: boolean;
}

/**
 * Para páginas que NO pueden calcular el estado de "sigo a X" en su propio render de
 * servidor (app/tournaments/[id]/page.tsx: `generateStaticParams` + `revalidate`, HTML
 * compartido entre TODOS los visitantes durante 10 min — igual que
 * app/tournaments/[id]/actions.ts::getMyNextOpponent ya resuelve para el próximo
 * rival). Un Client Component la pide sola al montar; la página en sí nunca toca la
 * sesión del visitante en su propio render, así que sigue siendo estática de verdad.
 */
export async function getMyFollowState(targetType: FollowTargetType, targetId: number): Promise<boolean> {
  const user = await getCurrentUser();
  return isFollowing(user?.id ?? null, targetType, targetId);
}

/** Mismo patrón exacto que app/news/[slug]/actions.ts::toggleNewsLike (comprobar
 * existente → borrar o insertar contra la clave única) — sin contador, a diferencia de
 * los likes: nadie enseña "N personas siguen esto" en esta primera versión. */
export async function toggleFollow(targetType: FollowTargetType, targetId: number, revalidatePathHref: string): Promise<ToggleFollowOutcome> {
  const user = await requireUser();

  const [existing] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.userId, user.id), eq(follows.targetType, targetType), eq(follows.targetId, targetId)));

  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
  } else {
    await db.insert(follows).values({ userId: user.id, targetType, targetId });
  }

  revalidatePath(revalidatePathHref);
  revalidatePath("/following");
  return { following: !existing };
}
