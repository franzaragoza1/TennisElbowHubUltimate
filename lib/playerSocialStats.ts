import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, discussionTopics, follows, news } from "@/db/schema";
import { getLastSiteActivity, type LastSiteActivity } from "@/lib/lastSiteActivity";

export interface PlayerLinkedStats {
  followingCount: number;
  topicsPostedCount: number;
  /** null = no es reportero aprobado — la propia tarjeta omite el dato entero en vez
   * de enseñar un "0" que sugeriría que sí puede escribir noticias y no lo ha hecho. */
  articlesPostedCount: number | null;
  lastActivity: LastSiteActivity | null;
}

export interface PlayerSocialStats {
  followerCount: number;
  /** null = esta ficha no está reclamada por ninguna cuenta — nada de lo de abajo
   * (seguidos, temas, artículos, última actividad) existe todavía para nadie. */
  linked: PlayerLinkedStats | null;
}

/**
 * Deliberadamente FUERA de `getPlayerPageData` (app/players/[id]/page.tsx), aunque no
 * dependa de quién mira la página (a diferencia de `isFollowing`, esto sí es igual para
 * todo el mundo) — ese `unstable_cache` toma varios argumentos (playerId, año, tier), la
 * misma forma que el bug real encontrado y corregido esta noche en /rankings (un
 * resultado se quedaba sirviendo datos viejos indefinidamente pese a reiniciar el
 * proceso). Hasta que esa caché se audite a fondo, cualquier dato nuevo que cambie a
 * menudo (seguidores, última actividad) se queda fuera de ella a propósito — más
 * barato de sobra sin necesitar cachearse, y nunca se queda pegado.
 */
export async function getPlayerSocialStats(playerId: number, linkedUserId: string | null): Promise<PlayerSocialStats> {
  const followerQuery = db.select({ value: count() }).from(follows).where(and(eq(follows.targetType, "player"), eq(follows.targetId, playerId)));
  if (!linkedUserId) {
    const [followerRow] = await followerQuery;
    return { followerCount: followerRow?.value ?? 0, linked: null };
  }

  // El contador de seguidores en la misma tanda que el resto (pase de rendimiento,
  // 2026-10-11) — antes iba primero, solo, y añadía un viaje a la BD a cada ficha.
  const [[followerRow], followingRow, topicsRow, userRow, lastActivity] = await Promise.all([
    followerQuery,
    db.select({ value: count() }).from(follows).where(eq(follows.userId, linkedUserId)),
    db.select({ value: count() }).from(discussionTopics).where(eq(discussionTopics.authorUserId, linkedUserId)),
    db.select({ isReporter: authUsers.isReporter }).from(authUsers).where(eq(authUsers.id, linkedUserId)),
    getLastSiteActivity(linkedUserId),
  ]);

  const isReporter = userRow[0]?.isReporter ?? false;
  let articlesPostedCount: number | null = null;
  if (isReporter) {
    const [row] = await db.select({ value: count() }).from(news).where(and(eq(news.submittedByUserId, linkedUserId), eq(news.status, "published")));
    articlesPostedCount = row?.value ?? 0;
  }

  return {
    followerCount: followerRow?.value ?? 0,
    linked: {
      followingCount: followingRow[0]?.value ?? 0,
      topicsPostedCount: topicsRow[0]?.value ?? 0,
      articlesPostedCount,
      lastActivity,
    },
  };
}
