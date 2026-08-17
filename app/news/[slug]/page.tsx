import Link from "next/link";
import { notFound } from "next/navigation";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { getNewsBySlug, getPublishedSlugs } from "@/lib/newsQueries";
import { surfaceColor } from "@/lib/surfaceColors";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = await getNewsBySlug(slug);
  if (!story) notFound();

  const published = story.publishedAt
    ? story.publishedAt.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <PageMasthead
        eyebrow={story.category}
        title={story.title}
        subtitle={published ?? undefined}
        accentColor={story.surface ? surfaceColor(story.surface) : undefined}
      />

      <div className="tour-container tour-container--medium py-10 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <article className="min-w-0 max-w-[640px]">
          {story.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria
            <img
              src={story.imageUrl}
              alt=""
              className="mb-8 w-full rounded-xl border border-rule object-cover"
            />
          )}

          <p className="text-headline mb-6 text-lg leading-relaxed text-ink">
            {story.excerpt}
          </p>

          <div className="space-y-4 text-[17px] leading-relaxed text-ink">
            {story.body
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>

          {(story.taggedPlayers.length > 0 || story.editionId) && (
            <div className="mt-10 border-t border-rule pt-6">
              <p className="text-eyebrow mb-3 text-xs text-muted-label">In this story</p>
              <div className="flex flex-wrap gap-2">
                {story.taggedPlayers.map((p) => (
                  <Link
                    key={p.id}
                    href={`/players/${p.id}`}
                    className="flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-sm text-ink transition hover:border-blue-500"
                  >
                    <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                      <CountryFlag country={p.country} className="h-full w-full object-cover" />
                    </span>
                    {p.displayName}
                  </Link>
                ))}
                {story.editionId && story.eventName && (
                  <Link
                    href={`/tournaments/${story.editionId}`}
                    className="rounded-full border border-rule bg-paper px-3 py-1.5 text-sm text-ink transition hover:border-blue-500"
                  >
                    {story.eventName}
                  </Link>
                )}
              </div>
            </div>
          )}

          <Link
            href="/news"
            className="text-eyebrow mt-10 inline-block text-xs text-blue-500 hover:underline"
          >
            ← All news
          </Link>
        </article>
        <Sidebar hide={["news", "videos"]} />
      </div>
    </div>
  );
}
