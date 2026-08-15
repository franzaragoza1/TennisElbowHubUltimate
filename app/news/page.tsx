import Link from "next/link";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { FeaturedVideos } from "@/components/news/FeaturedVideos";
import { getPublishedNews } from "@/lib/newsQueries";
import { getFeaturedVideos } from "@/lib/youtube/featured";
import { surfaceColor } from "@/lib/surfaceColors";

export const revalidate = 300;

export default async function NewsIndexPage() {
  const [stories, videos] = await Promise.all([getPublishedNews(), getFeaturedVideos(2)]);

  return (
    <div>
      <PageMasthead
        eyebrow="Tennis Elbow 4 Online Tour"
        title="News"
        subtitle={
          stories.length === 0
            ? undefined
            : `${stories.length} ${stories.length === 1 ? "story" : "stories"}`
        }
      />

      <div className="tour-container tour-container--reading py-8">
        <FeaturedVideos videos={videos} />

        {stories.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-12 text-center">
            Nothing published yet.
          </p>
        ) : (
          <div className="space-y-4">
            {stories.map((s) => (
              <Link
                key={s.id}
                href={`/news/${s.slug}`}
                className="group flex gap-4 overflow-hidden rounded-lg border border-rule bg-paper transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <div
                  className="w-1.5 shrink-0"
                  style={{
                    backgroundColor: s.surface ? surfaceColor(s.surface) : "var(--navy-700)",
                  }}
                />
                <div className="min-w-0 flex-1 py-4 pr-4">
                  <p className="text-eyebrow text-[10px] text-muted-label">
                    {s.category}
                    {s.publishedAt
                      ? ` · ${s.publishedAt.toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                  </p>
                  <h2 className="text-headline mt-1 text-lg text-ink group-hover:text-blue-500">
                    {s.title}
                  </h2>
                  <p className="text-muted-label mt-1 line-clamp-2 text-sm">{s.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
