"use server";

import { logAdminChange } from "@/lib/adminChangeLog";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { news, newsComments } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";

/** Igual que app/news/[slug]/actions.ts::deleteComment, pero para la pestaña de
 * moderación site-wide: ahí no se tiene el slug a mano (la lista mezcla comentarios de
 * artículos distintos), así que se busca aquí antes de borrar. */
export async function deleteCommentAsAdmin(commentId: number): Promise<void> {
  await requireAdmin();
  await logAdminChange("admin.moderation", "Deleted a comment", { details: { commentId } });

  const [row] = await db
    .select({ slug: news.slug })
    .from(newsComments)
    .innerJoin(news, eq(news.id, newsComments.newsId))
    .where(eq(newsComments.id, commentId));
  if (!row) return;

  await db.delete(newsComments).where(eq(newsComments.id, commentId));
  revalidatePath(`/news/${row.slug}`);
}
