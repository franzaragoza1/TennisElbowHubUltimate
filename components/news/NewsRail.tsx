import Link from "next/link";
import type { NewsCardData } from "@/lib/newsQueries";
import { surfaceColor } from "@/lib/surfaceColors";

const CATEGORY_COLOR: Record<string, string> = {
  REPORT: "var(--blue-500)",
  ANNOUNCEMENT: "var(--accent-500)",
  RESULTS: "var(--up)",
  FEATURE: "var(--navy-700)",
};

function accentFor(item: NewsCardData): string {
  // El torneo manda sobre la categoría: el color de superficie es un dato real.
  if (item.surface) return surfaceColor(item.surface);
  return CATEGORY_COLOR[item.category] ?? "var(--navy-700)";
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function NewsCard({ item }: { item: NewsCardData }) {
  const accent = accentFor(item);
  const onBrightAccent = accent === "var(--accent-500)";

  return (
    <article className="news-card w-[280px] shrink-0 sm:w-[340px]">
      <Link
        href={`/news/${item.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-rule bg-paper transition hover:border-blue-500 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <div className="relative h-36 overflow-hidden" style={{ backgroundColor: accent }}>
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria, fuera del optimizador
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          )}
          <span
            className={`text-eyebrow absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] ${
              item.imageUrl
                ? "bg-navy-900/85 text-white"
                : onBrightAccent
                  ? "bg-navy-900 text-accent-500"
                  : "bg-white/20 text-white"
            }`}
          >
            {item.category}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="text-headline text-lg leading-snug text-ink group-hover:text-blue-500">
            {item.title}
          </h3>
          <p className="text-muted-label mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
            {item.excerpt}
          </p>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-rule pt-3">
            <span className="tour-numeric text-muted-label text-xs">
              {formatDate(item.publishedAt)}
            </span>
            {item.taggedPlayers.length > 0 && (
              <span className="text-eyebrow truncate text-[10px] text-ink">
                {item.taggedPlayers
                  .slice(0, 2)
                  .map((p) => p.displayName)
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

/**
 * Carril horizontal de noticias. El revelado de cada tarjeta y la barra de progreso los
 * mueve el propio scroll vía CSS (`animation-timeline`, ver globals.css) — sin JS.
 */
export function NewsRail({ items }: { items: NewsCardData[] }) {
  if (items.length === 0) return null;

  return (
    <section className="news-rail-scope py-12">
      <div className="tour-container mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-headline text-xl text-ink sm:text-2xl">Latest news</h2>
        <Link href="/news" className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
          All news
        </Link>
      </div>

      {/* El carril sangra hasta el borde para que se vea que hay más a la derecha. */}
      <div className="news-rail flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>

      <div className="tour-container mt-4">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-rule">
          <div className="news-progress-bar h-full w-full rounded-full bg-navy-900" />
        </div>
      </div>
    </section>
  );
}
