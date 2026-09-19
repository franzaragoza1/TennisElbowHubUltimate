import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, discussionTopics, topicComments, topicCommentLikes, topicLikes } from "@/db/schema";
import { memoizeWithTtl } from "@/lib/memoCache";

export interface CommentNode {
  id: number;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  body: string;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
}

export interface ReplyNode extends CommentNode {
  /** Resuelto en el momento de leer, nunca guardado como texto — mismo criterio que
   * lib/comments.ts::ReplyNode.replyingToName. */
  replyingToName: string | null;
}

export interface TopLevelComment extends CommentNode {
  replies: ReplyNode[];
}

interface BaseRow {
  id: number;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  body: string;
  createdAt: Date;
  parentId: number | null;
  rootId: number | null;
}

/** Copia literal de lib/comments.ts::getCommentsForNews contra las tablas de temas —
 * ver ese fichero para el porqué del algoritmo (3 idas a la base de datos sin importar
 * cuántos comentarios haya, árbol construido en memoria, nunca SQL recursivo). */
export async function getCommentsForTopic(topicId: number, currentUserId: string | null): Promise<TopLevelComment[]> {
  const rows: BaseRow[] = await db
    .select({
      id: topicComments.id,
      userId: topicComments.userId,
      authorName: authUsers.name,
      authorImage: authUsers.image,
      body: topicComments.body,
      createdAt: topicComments.createdAt,
      parentId: topicComments.parentId,
      rootId: topicComments.rootId,
    })
    .from(topicComments)
    .innerJoin(authUsers, eq(authUsers.id, topicComments.userId))
    .where(eq(topicComments.topicId, topicId))
    .orderBy(asc(topicComments.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [likeCounts, likedByMeRows] = await Promise.all([
    db
      .select({ commentId: topicCommentLikes.commentId, value: sql<number>`count(*)::int` })
      .from(topicCommentLikes)
      .where(inArray(topicCommentLikes.commentId, ids))
      .groupBy(topicCommentLikes.commentId),
    currentUserId
      ? db
          .select({ commentId: topicCommentLikes.commentId })
          .from(topicCommentLikes)
          .where(and(inArray(topicCommentLikes.commentId, ids), eq(topicCommentLikes.userId, currentUserId)))
      : Promise.resolve([]),
  ]);

  const likeCountById = new Map(likeCounts.map((r) => [r.commentId, r.value]));
  const likedByMeIds = new Set(likedByMeRows.map((r) => r.commentId));
  const authorNameById = new Map(rows.map((r) => [r.id, r.authorName]));

  function toNode(r: BaseRow): CommentNode {
    return {
      id: r.id,
      userId: r.userId,
      authorName: r.authorName,
      authorImage: r.authorImage,
      body: r.body,
      createdAt: r.createdAt,
      likeCount: likeCountById.get(r.id) ?? 0,
      likedByMe: likedByMeIds.has(r.id),
    };
  }

  const repliesByRoot = new Map<number, ReplyNode[]>();
  for (const r of rows) {
    if (r.rootId === null) continue;
    const list = repliesByRoot.get(r.rootId) ?? [];
    list.push({ ...toNode(r), replyingToName: r.parentId !== null ? (authorNameById.get(r.parentId) ?? null) : null });
    repliesByRoot.set(r.rootId, list);
  }

  return rows
    .filter((r) => r.rootId === null)
    .map((r) => ({ ...toNode(r), replies: repliesByRoot.get(r.id) ?? [] }));
}

export interface ModerationTopicCommentRow {
  id: number;
  body: string;
  createdAt: Date;
  authorName: string | null;
  topicSlug: string;
  topicTitle: string;
  isReply: boolean;
}

/** Mismo criterio que lib/comments.ts::getRecentCommentsForModeration — sin paginar,
 * 200 recientes de sobra para el tamaño de esta comunidad. */
export async function getRecentTopicCommentsForModeration(limit = 200): Promise<ModerationTopicCommentRow[]> {
  return db
    .select({
      id: topicComments.id,
      body: topicComments.body,
      createdAt: topicComments.createdAt,
      authorName: authUsers.name,
      topicSlug: discussionTopics.slug,
      topicTitle: discussionTopics.title,
      isReply: sql<boolean>`${topicComments.parentId} is not null`,
    })
    .from(topicComments)
    .innerJoin(authUsers, eq(authUsers.id, topicComments.userId))
    .innerJoin(discussionTopics, eq(discussionTopics.id, topicComments.topicId))
    .orderBy(desc(topicComments.createdAt))
    .limit(limit);
}

export interface TopicFeedRow {
  id: number;
  slug: string;
  title: string;
  body: string;
  status: string;
  authorName: string | null;
  authorImage: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
}

const FEED_PAGE_SIZE = 20;

/** Feed plano, ordenado por actividad reciente (no por creación) — un tema de hace dos
 * semanas con una respuesta de hace 5 minutos debe subir arriba. Paginado por cursor de
 * id (mismo criterio simple usado en otros listados de este proyecto), nunca offset. */
/**
 * `app/discussions/page.tsx` es `force-dynamic` (necesita `getCurrentUser()` por
 * visitante, para decidir "New topic" vs. "Sign in"), así que esta consulta —2 counts
 * correlacionados por fila de más— se repetía enteras en cada carga de una página
 * pública compartida entre todos los visitantes (auditoría de rendimiento,
 * 2026-09-19). `memoizeWithTtl`, no `unstable_cache`: no hace falta que el resultado
 * sobreviva a un reinicio del proceso, y así se evita el paso de
 * `JSON.stringify`/`JSON.parse` sobre los `Date` de cada fila. TTL corto (30s) a
 * propósito — a diferencia de rankings/stats/tournaments esto SÍ es contenido nuevo
 * de gente escribiendo ahora mismo, no queremos que un tema nuevo tarde minutos en
 * aparecer.
 */
export const getDiscussionTopicsPage = memoizeWithTtl(async (cursor: number | null): Promise<{ rows: TopicFeedRow[]; nextCursor: number | null }> => {
  const rows = await db
    .select({
      id: discussionTopics.id,
      slug: discussionTopics.slug,
      title: discussionTopics.title,
      body: discussionTopics.body,
      status: discussionTopics.status,
      authorName: authUsers.name,
      authorImage: authUsers.image,
      lastActivityAt: discussionTopics.lastActivityAt,
      createdAt: discussionTopics.createdAt,
      commentCount: sql<number>`(select count(*)::int from ${topicComments} where ${topicComments.topicId} = ${discussionTopics.id})`,
      likeCount: sql<number>`(select count(*)::int from ${topicLikes} where ${topicLikes.topicId} = ${discussionTopics.id})`,
    })
    .from(discussionTopics)
    .innerJoin(authUsers, eq(authUsers.id, discussionTopics.authorUserId))
    .where(cursor !== null ? lt(discussionTopics.id, cursor) : undefined)
    .orderBy(desc(discussionTopics.lastActivityAt))
    .limit(FEED_PAGE_SIZE + 1);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}, 30_000);

export interface TopicDetail {
  id: number;
  slug: string;
  title: string;
  body: string;
  status: string;
  authorUserId: string;
  authorName: string | null;
  authorImage: string | null;
  createdAt: Date;
}

export async function getTopicBySlug(slug: string): Promise<TopicDetail | null> {
  const [row] = await db
    .select({
      id: discussionTopics.id,
      slug: discussionTopics.slug,
      title: discussionTopics.title,
      body: discussionTopics.body,
      status: discussionTopics.status,
      authorUserId: discussionTopics.authorUserId,
      authorName: authUsers.name,
      authorImage: authUsers.image,
      createdAt: discussionTopics.createdAt,
    })
    .from(discussionTopics)
    .innerJoin(authUsers, eq(authUsers.id, discussionTopics.authorUserId))
    .where(eq(discussionTopics.slug, slug));
  return row ?? null;
}

export interface ModerationTopicRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  authorName: string | null;
  createdAt: Date;
  commentCount: number;
}

export async function getRecentTopicsForModeration(limit = 200): Promise<ModerationTopicRow[]> {
  return db
    .select({
      id: discussionTopics.id,
      slug: discussionTopics.slug,
      title: discussionTopics.title,
      status: discussionTopics.status,
      authorName: authUsers.name,
      createdAt: discussionTopics.createdAt,
      commentCount: sql<number>`(select count(*)::int from ${topicComments} where ${topicComments.topicId} = ${discussionTopics.id})`,
    })
    .from(discussionTopics)
    .innerJoin(authUsers, eq(authUsers.id, discussionTopics.authorUserId))
    .orderBy(desc(discussionTopics.createdAt))
    .limit(limit);
}
