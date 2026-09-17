import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, newsComments } from "@/db/schema";

export interface CommentRow {
  id: number;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  body: string;
  createdAt: Date;
}

export async function getCommentsForNews(newsId: number): Promise<CommentRow[]> {
  return db
    .select({
      id: newsComments.id,
      userId: newsComments.userId,
      authorName: authUsers.name,
      authorImage: authUsers.image,
      body: newsComments.body,
      createdAt: newsComments.createdAt,
    })
    .from(newsComments)
    .innerJoin(authUsers, eq(authUsers.id, newsComments.userId))
    .where(eq(newsComments.newsId, newsId))
    .orderBy(asc(newsComments.createdAt));
}
