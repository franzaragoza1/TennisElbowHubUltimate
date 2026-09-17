"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { newsComments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { isRateLimited } from "@/lib/rateLimit";

const MAX_COMMENT_LENGTH = 1000;

export interface PostCommentOutcome {
  error: string | null;
}

export async function postComment(newsId: number, slug: string, formData: FormData): Promise<PostCommentOutcome> {
  const user = await requireUser();

  if (await isRateLimited(`news-comment:${user.id}`, 5 * 60 * 1000, 5)) {
    return { error: "Too many comments — try again in a few minutes." };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something before posting." };
  if (body.length > MAX_COMMENT_LENGTH) return { error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters.` };

  await db.insert(newsComments).values({ newsId, userId: user.id, body });

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
