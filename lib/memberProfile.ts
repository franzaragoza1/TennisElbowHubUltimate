import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, discussionTopics, news, newsComments, topicComments } from "@/db/schema";
import { getLastSiteActivity, type LastSiteActivity } from "@/lib/lastSiteActivity";

export interface MemberProfile {
  userId: string;
  displayName: string;
  image: string | null;
  bio: string | null;
  isReporter: boolean;
  topicsPostedCount: number;
  commentsPostedCount: number;
  /** null = no es reportero aprobado — misma razón que en lib/playerSocialStats.ts. */
  articlesPostedCount: number | null;
  lastActivity: LastSiteActivity | null;
}

/**
 * Perfil ligero para una cuenta SIN jugador del tour vinculado — pedido explícito,
 * 2026-09-18: cualquier cuenta logueada ya puede comentar/publicar temas/seguir cosas
 * sin serlo, así que necesita algo a lo que enlazar cuando aparece como autor de un
 * comentario. A propósito mucho más simple que lib/playerSocialStats.ts: nada de
 * seguidores/seguidos (esta cuenta no es un `follows`-target, ver el comentario de
 * app/members/[userId]/page.tsx) ni campos propios del tour (playstyle, racket...) —
 * solo identidad + actividad real en el sitio.
 */
export async function getMemberProfile(userId: string): Promise<MemberProfile | null> {
  const [user] = await db.select({ name: authUsers.name, image: authUsers.image, bio: authUsers.bio, isReporter: authUsers.isReporter }).from(authUsers).where(eq(authUsers.id, userId));
  if (!user) return null;

  const [topicsRow, topicCommentsRow, newsCommentsRow, lastActivity] = await Promise.all([
    db.select({ value: count() }).from(discussionTopics).where(eq(discussionTopics.authorUserId, userId)),
    db.select({ value: count() }).from(topicComments).where(eq(topicComments.userId, userId)),
    db.select({ value: count() }).from(newsComments).where(eq(newsComments.userId, userId)),
    getLastSiteActivity(userId),
  ]);

  let articlesPostedCount: number | null = null;
  if (user.isReporter) {
    const [row] = await db.select({ value: count() }).from(news).where(and(eq(news.submittedByUserId, userId), eq(news.status, "published")));
    articlesPostedCount = row?.value ?? 0;
  }

  return {
    userId,
    displayName: user.name ?? "Anonymous",
    image: user.image,
    bio: user.bio,
    isReporter: user.isReporter,
    topicsPostedCount: topicsRow[0]?.value ?? 0,
    commentsPostedCount: (topicCommentsRow[0]?.value ?? 0) + (newsCommentsRow[0]?.value ?? 0),
    articlesPostedCount,
    lastActivity,
  };
}
