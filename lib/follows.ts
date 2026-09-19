import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { follows } from "@/db/schema";

export type FollowTargetType = "player" | "edition" | "topic";

/**
 * Lectura por-visitante — SIEMPRE fuera de cualquier `unstable_cache`/ISR compartido
 * entre visitantes (app/players/[id]/page.tsx y app/tournaments/[id]/page.tsx cachean
 * su consulta principal; esta nunca debe entrar ahí, o el estado de "sigo a X" de una
 * persona se filtraría a todas las demás — mismo motivo por el que `admin`/`playerId`
 * se calculan fuera de la función cacheada en app/account/page.tsx).
 */
export async function isFollowing(userId: string | null, targetType: FollowTargetType, targetId: number): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.targetType, targetType), eq(follows.targetId, targetId)));
  return row !== undefined;
}
