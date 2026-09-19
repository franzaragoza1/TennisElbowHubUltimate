"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { newsComments, newsCommentLikes, newsLikes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { isRateLimited } from "@/lib/rateLimit";

const MAX_COMMENT_LENGTH = 1000;

export interface PostCommentOutcome {
  error: string | null;
}

export interface ToggleLikeOutcome {
  count: number;
  liked: boolean;
}

export async function postComment(newsId: number, slug: string, formData: FormData): Promise<PostCommentOutcome> {
  const user = await requireUser();

  if (await isRateLimited(`news-comment:${user.id}`, 5 * 60 * 1000, 5)) {
    return { error: "Too many comments — try again in a few minutes." };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something before posting." };
  if (body.length > MAX_COMMENT_LENGTH) return { error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters.` };

  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  // `rootId` se calcula aquí, nunca se confía en el cliente — una respuesta a una
  // respuesta hereda el `rootId` de esa respuesta (nunca anida un nivel visual más),
  // ver lib/comments.ts para cómo se agrupa luego en pantalla.
  let rootId: number | null = null;
  if (parentId !== null) {
    const [parent] = await db.select({ id: newsComments.id, rootId: newsComments.rootId }).from(newsComments).where(eq(newsComments.id, parentId));
    if (!parent) return { error: "That comment no longer exists." };
    rootId = parent.rootId ?? parent.id;
  }

  await db.insert(newsComments).values({ newsId, userId: user.id, body, parentId, rootId });

  revalidatePath(`/news/${slug}`);
  return { error: null };
}

export async function deleteComment(commentId: number, slug: string): Promise<void> {
  const user = await requireUser();

  const [comment] = await db.select({ userId: newsComments.userId }).from(newsComments).where(eq(newsComments.id, commentId));
  if (!comment) return;

  const canDelete = comment.userId === user.id || (await isAdmin(user));
  if (!canDelete) return;

  await db.delete(newsComments).where(eq(newsComments.id, commentId));
  revalidatePath(`/news/${slug}`);
}

export async function toggleNewsLike(newsId: number, slug: string): Promise<ToggleLikeOutcome> {
  const user = await requireUser();

  const [existing] = await db.select({ id: newsLikes.id }).from(newsLikes).where(and(eq(newsLikes.newsId, newsId), eq(newsLikes.userId, user.id)));
  if (existing) {
    await db.delete(newsLikes).where(eq(newsLikes.id, existing.id));
  } else {
    await db.insert(newsLikes).values({ newsId, userId: user.id });
  }

  revalidatePath(`/news/${slug}`);
  const [{ value }] = await db.select({ value: count() }).from(newsLikes).where(eq(newsLikes.newsId, newsId));
  return { count: value, liked: !existing };
}

export async function toggleCommentLike(commentId: number, slug: string): Promise<ToggleLikeOutcome> {
  const user = await requireUser();

  const [existing] = await db
    .select({ id: newsCommentLikes.id })
    .from(newsCommentLikes)
    .where(and(eq(newsCommentLikes.commentId, commentId), eq(newsCommentLikes.userId, user.id)));
  if (existing) {
    await db.delete(newsCommentLikes).where(eq(newsCommentLikes.id, existing.id));
  } else {
    await db.insert(newsCommentLikes).values({ commentId, userId: user.id });
  }

  revalidatePath(`/news/${slug}`);
  const [{ value }] = await db.select({ value: count() }).from(newsCommentLikes).where(eq(newsCommentLikes.commentId, commentId));
  return { count: value, liked: !existing };
}
