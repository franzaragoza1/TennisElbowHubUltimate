import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { newsLikes } from "@/db/schema";

export interface LikeInfo {
  count: number;
  likedByMe: boolean;
}

export async function getNewsLikeInfo(newsId: number, userId: string | null): Promise<LikeInfo> {
  const [[{ value }], liked] = await Promise.all([
    db.select({ value: count() }).from(newsLikes).where(eq(newsLikes.newsId, newsId)),
    userId
      ? db
          .select({ id: newsLikes.id })
          .from(newsLikes)
          .where(and(eq(newsLikes.newsId, newsId), eq(newsLikes.userId, userId)))
      : Promise.resolve([]),
  ]);
  return { count: value, likedByMe: liked.length > 0 };
}
