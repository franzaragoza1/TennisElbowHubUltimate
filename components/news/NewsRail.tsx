import Link from "next/link";
import type { NewsCardData } from "@/lib/newsQueries";
import { surfaceColor } from "@/lib/surfaceColors";
import { remoteImageSrc } from "@/lib/remoteImage";

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

type NewsRailSize = "default" | "compact";

function NewsCard({ item, size }: { item: NewsCardData; size: NewsRailSize }) {
  const accent = accentFor(item);
  const onBrightAccent = accent === "var(--accent-500)";
  const compact = size === "compact";

  return (
    <article className={`news-card shrink-0 ${compact ? "w-[220px] sm:w-[260px]" : "w-[280px] sm:w-[340px]"}`}>
      <Link
        href={`/news/${item.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-rule bg-paper transition hover:border-blue-500 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <div className={`relative overflow-hidden ${compact ? "h-24" : "h-36"}`} style={{ backgroundColor: accent }}>
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria, fuera del optimizador
            <img
              src={remoteImageSrc(item.imageUrl, 400)}
              alt=""
              loading="lazy"
              decoding="async"
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

        <div className={`flex flex-1 flex-col ${compact ? "p-3" : "p-4"}`}>
          <h3 className={`text-headline leading-snug text-ink group-hover:text-blue-500 ${compact ? "text-sm" : "text-lg"}`}>
            {item.title}
          </h3>
          {!compact && (
            <p className="text-muted-label mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">{item.excerpt}</p>
          )}
          <div className={`flex items-center justify-between gap-2 border-t border-rule pt-3 ${compact ? "mt-2" : "mt-4"}`}>
            <span className="tour-numeric text-muted-label text-xs">
              {formatDate(item.publishedAt)}
            </span>
            {/* Autor, no jugadores etiquetados — pedido explícito (2026-09-17): "news
             * here shouldnt show tagged players but the author, and the author must
             * be automatically shown". `item.author` ya no puede ser null para nada
             * publicado de aquí en adelante (saveNews/submitReporterStory rellenan
             * solos con quien publica si se deja en blanco, ver app/admin/actions.ts),
             * pero el histórico anterior a este cambio se rellenó a mano en la base de
             * datos en vez de dejar el fallback silencioso — más simple que dos
             * caminos de render distintos aquí. */}
            <span className="text-eyebrow truncate text-[10px] text-ink">{item.author}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

/**
 * Carril horizontal de noticias. El revelado de cada tarjeta lo mueve el propio
 * scroll vía CSS (`animation-timeline`, ver globals.css) — sin JS.
 *
 * `size="compact"` — pedido explícito (2026-09-17): el mismo carril, pero más pequeño,
 * pegado justo debajo del módulo de H2H en `/players`
 * (components/players/PlayersH2HCompare.tsx). La home sigue con `size="default"`
 * (el valor por omisión) — tarjetas más grandes, con extracto, y más aire arriba.
 */
export function NewsRail({ items, size = "default" }: { items: NewsCardData[]; size?: NewsRailSize }) {
  if (items.length === 0) return null;
  const compact = size === "compact";

  return (
    <section className={compact ? "pt-6 pb-8" : "py-12"}>
      <div className={`tour-container flex items-baseline justify-between gap-4 ${compact ? "mb-3" : "mb-5"}`}>
        <h2 className={`text-headline text-ink ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>Latest news</h2>
        <Link href="/news" className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
          All news
        </Link>
      </div>

      {/* El carril sangra hasta el borde para que se vea que hay más a la derecha. */}
      <div className="news-rail flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} size={size} />
        ))}
      </div>
    </section>
  );
}
