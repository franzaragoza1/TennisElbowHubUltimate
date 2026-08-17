import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { news } from "@/db/schema";
import { deleteNews } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminNewsListPage() {
  const rows = await db
    .select({
      id: news.id,
      title: news.title,
      slug: news.slug,
      category: news.category,
      status: news.status,
      publishedAt: news.publishedAt,
      updatedAt: news.updatedAt,
    })
    .from(news)
    .orderBy(desc(news.updatedAt));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-headline text-2xl text-ink">News</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/news/generate"
            className="text-eyebrow rounded-full border border-rule px-5 py-2.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500"
          >
            Generate AI drafts
          </Link>
          <Link
            href="/admin/news/new"
            className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800"
          >
            New story
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
          No stories yet. Write the first one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-0"
            >
              <span
                className={`text-eyebrow shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                  r.status === "published"
                    ? "bg-up/10 text-up"
                    : "bg-muted-label/10 text-muted-label"
                }`}
              >
                {r.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-headline truncate text-ink">{r.title}</p>
                <p className="text-muted-label truncate text-xs">
                  {r.category} · {r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : "—"}
                </p>
              </div>
              <Link
                href={`/admin/news/${r.id}`}
                className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline"
              >
                Edit
              </Link>
              <form action={deleteNews} className="shrink-0">
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="text-eyebrow text-xs text-down hover:underline"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
