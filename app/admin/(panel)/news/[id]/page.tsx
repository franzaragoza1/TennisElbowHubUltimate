import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { news, newsPlayers } from "@/db/schema";
import { NewsForm } from "@/components/admin/NewsForm";
import { getNewsFormOptions } from "@/lib/adminQueries";

export const dynamic = "force-dynamic";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isInteger(newsId)) notFound();

  const [[story], tags, { players, editions }] = await Promise.all([
    db.select().from(news).where(eq(news.id, newsId)),
    db
      .select({ playerId: newsPlayers.playerId })
      .from(newsPlayers)
      .where(eq(newsPlayers.newsId, newsId)),
    getNewsFormOptions(),
  ]);
  if (!story) notFound();

  return (
    <div>
      <h1 className="text-headline mb-6 text-2xl text-navy-900">Edit story</h1>
      <NewsForm
        players={players}
        editions={editions}
        values={{
          id: story.id,
          title: story.title,
          excerpt: story.excerpt,
          body: story.body,
          category: story.category,
          imageUrl: story.imageUrl ?? "",
          editionId: story.editionId,
          published: story.status === "published",
          playerIds: tags.map((t) => t.playerId),
        }}
      />
    </div>
  );
}
