import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, news, newsComments, newsCommentLikes } from "@/db/schema";

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
  /** Resuelto en el momento de leer, nunca guardado como texto — si el autor del
   * padre cambia de nombre en Discord, el tag lo refleja solo, no queda obsoleto. */
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

export async function getCommentsForNews(newsId: number, currentUserId: string | null): Promise<TopLevelComment[]> {
  const rows: BaseRow[] = await db
    .select({
      id: newsComments.id,
      userId: newsComments.userId,
      authorName: authUsers.name,
      authorImage: authUsers.image,
      body: newsComments.body,
      createdAt: newsComments.createdAt,
      parentId: newsComments.parentId,
      rootId: newsComments.rootId,
    })
    .from(newsComments)
    .innerJoin(authUsers, eq(authUsers.id, newsComments.userId))
    .where(eq(newsComments.newsId, newsId))
    .orderBy(asc(newsComments.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [likeCounts, likedByMeRows] = await Promise.all([
    db
      .select({ commentId: newsCommentLikes.commentId, value: sql<number>`count(*)::int` })
      .from(newsCommentLikes)
      .where(inArray(newsCommentLikes.commentId, ids))
      .groupBy(newsCommentLikes.commentId),
    currentUserId
      ? db
          .select({ commentId: newsCommentLikes.commentId })
          .from(newsCommentLikes)
          .where(and(inArray(newsCommentLikes.commentId, ids), eq(newsCommentLikes.userId, currentUserId)))
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

export interface ModerationCommentRow {
  id: number;
  body: string;
  createdAt: Date;
  authorName: string | null;
  newsSlug: string;
  newsTitle: string;
  isReply: boolean;
}

/** Vista de moderación site-wide — pedido explícito del propietario para no tener que
 * ir artículo por artículo a moderar. Sin paginar: 200 más recientes de sobra para el
 * tamaño de esta comunidad (mismo criterio que el resto de listas de admin). */
export async function getRecentCommentsForModeration(limit = 200): Promise<ModerationCommentRow[]> {
  return db
    .select({
      id: newsComments.id,
      body: newsComments.body,
      createdAt: newsComments.createdAt,
      authorName: authUsers.name,
      newsSlug: news.slug,
      newsTitle: news.title,
      isReply: sql<boolean>`${newsComments.parentId} is not null`,
    })
    .from(newsComments)
    .innerJoin(authUsers, eq(authUsers.id, newsComments.userId))
    .innerJoin(news, eq(news.id, newsComments.newsId))
    .orderBy(desc(newsComments.createdAt))
    .limit(limit);
}
