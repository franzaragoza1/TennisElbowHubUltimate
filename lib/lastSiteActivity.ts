import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { discussionTopics, news, newsComments, topicComments } from "@/db/schema";

export interface LastSiteActivity {
  kind: "topic_comment" | "news_comment";
  href: string;
  contextTitle: string;
  createdAt: Date;
}

/** Compartido entre lib/playerSocialStats.ts (jugador vinculado) y lib/memberProfile.ts
 * (cuenta sin jugador vinculado) — la MISMA consulta/mezcla de "última respuesta en un
 * tema o en un artículo", sin duplicarla: a diferencia de la duplicación deliberada
 * entre componentes de temas/noticias (contenido genuinamente distinto), aquí es
 * literalmente la misma lógica para dos llamadores. */
export async function getLastSiteActivity(userId: string): Promise<LastSiteActivity | null> {
  const [lastTopicComment, lastNewsComment] = await Promise.all([
    db
      .select({ topicSlug: discussionTopics.slug, topicTitle: discussionTopics.title, createdAt: topicComments.createdAt })
      .from(topicComments)
      .innerJoin(discussionTopics, eq(discussionTopics.id, topicComments.topicId))
      .where(eq(topicComments.userId, userId))
      .orderBy(desc(topicComments.createdAt))
      .limit(1),
    db
      .select({ newsSlug: news.slug, newsTitle: news.title, createdAt: newsComments.createdAt })
      .from(newsComments)
      .innerJoin(news, eq(news.id, newsComments.newsId))
      .where(eq(newsComments.userId, userId))
      .orderBy(desc(newsComments.createdAt))
      .limit(1),
  ]);

  const candidates: LastSiteActivity[] = [];
  const t = lastTopicComment[0];
  if (t) candidates.push({ kind: "topic_comment", href: `/discussions/${t.topicSlug}`, contextTitle: t.topicTitle, createdAt: t.createdAt });
  const n = lastNewsComment[0];
  if (n) candidates.push({ kind: "news_comment", href: `/news/${n.newsSlug}`, contextTitle: n.newsTitle, createdAt: n.createdAt });
  candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return candidates[0] ?? null;
}
