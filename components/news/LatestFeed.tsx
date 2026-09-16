import Link from "next/link";
import type { NewsCardData } from "@/lib/newsQueries";
import type { FeaturedVideo } from "@/lib/youtube/featured";
import { surfaceColor } from "@/lib/surfaceColors";

export type LatestFeedItem = { kind: "news"; data: NewsCardData } | { kind: "video"; data: FeaturedVideo };

/**
 * `unstable_cache` serializa su resultado con `JSON.stringify`/`JSON.parse` (ver
 * node_modules/next/dist/server/web/spec-extension/unstable-cache.js) — cualquier
 * `Date` que cruce esa frontera vuelve como STRING, nunca como `Date` de verdad,
 * aunque el tipo declarado siga diciendo `Date`. `app/news/page.tsx` llama a las
 * consultas directamente (Date real); `app/players/[id]/page.tsx` las envuelve en
 * `unstable_cache` (string tras la primera vez que cachea de verdad) — el mismo dato
 * puede llegar aquí de las dos formas según de qué página venga. `new Date(x)` acepta
 * ambas por igual (y hasta otra `Date`, la clona), así que normalizar aquí es más
 * simple y más robusto que forzar un único tipo en cada llamador. Bug real reportado,
 * 2026-09-16: "a.publishedAt?.getTime is not a function" en la ficha de un jugador, en
 * cuanto esa caché consiguió escribir de verdad por primera vez.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

/** Mezcla noticias y vídeos en un único carril cronológico — pedido explícito
 * (2026-09-15): con el volumen de contenido real de este sitio, tres páginas
 * separadas (News/Videos/Interviews) se quedarían vacías la mayoría de las semanas;
 * juntas en un solo "Latest", un puñado de items ya se siente activo. */
export function mergeChronologically(stories: NewsCardData[], videos: FeaturedVideo[]): LatestFeedItem[] {
  const items: (LatestFeedItem & { sortAt: number })[] = [
    ...stories.map((data) => ({ kind: "news" as const, data, sortAt: toDate(data.publishedAt)?.getTime() ?? 0 })),
    ...videos.map((data) => ({ kind: "video" as const, data, sortAt: toDate(data.publishedAt)?.getTime() ?? 0 })),
  ];
  items.sort((a, b) => b.sortAt - a.sortAt);
  return items;
}

function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function formatDate(d: Date | string | null | undefined): string | null {
  const date = toDate(d);
  return date ? date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : null;
}

interface CardShape {
  key: string;
  href: string;
  external: boolean;
  imageUrl: string | null;
  colorFallback: string;
  isVideo: boolean;
  eyebrow: string;
  title: string;
  excerpt: string | null;
}

function toCardShape(item: LatestFeedItem): CardShape {
  if (item.kind === "news") {
    const s = item.data;
    const dateLabel = formatDate(s.publishedAt);
    return {
      key: `news-${s.id}`,
      href: `/news/${s.slug}`,
      external: false,
      imageUrl: s.imageUrl,
      colorFallback: s.surface ? surfaceColor(s.surface) : "var(--navy-700)",
      isVideo: false,
      eyebrow: dateLabel ? `${s.category} · ${dateLabel}` : s.category,
      title: s.title,
      excerpt: s.excerpt,
    };
  }
  const v = item.data;
  return {
    key: `video-${v.id}`,
    href: `https://www.youtube.com/watch?v=${v.youtubeVideoId}`,
    external: true,
    imageUrl: youtubeThumbnail(v.youtubeVideoId),
    colorFallback: "var(--navy-700)",
    isVideo: true,
    eyebrow: `VIDEO · ${formatDate(v.publishedAt)}`,
    title: v.caption ?? v.title,
    excerpt: null,
  };
}

function PlayBadge() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-navy-900/20 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-down text-white shadow-lg">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </div>
  );
}

function CardImage({ shape, aspect }: { shape: CardShape; aspect: string }) {
  return (
    <div className={`relative ${aspect} overflow-hidden bg-paper-tint`}>
      {shape.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura/imagen editorial remota, sin pipeline de next/image
        <img src={shape.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: shape.colorFallback }} />
      )}
      {shape.isVideo && <PlayBadge />}
    </div>
  );
}

function FeedLink({ shape, children, className }: { shape: CardShape; children: React.ReactNode; className: string }) {
  if (shape.external) {
    return (
      <a href={shape.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={shape.href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

function HeroCard({ item }: { item: LatestFeedItem }) {
  const shape = toCardShape(item);
  return (
    <FeedLink
      shape={shape}
      className="group block overflow-hidden rounded-lg border border-rule bg-paper transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <CardImage shape={shape} aspect="aspect-[16/9]" />
      <div className="p-5">
        <p className="text-eyebrow text-[10px] text-muted-label">{shape.eyebrow}</p>
        <h2 className="text-headline mt-1.5 text-2xl text-ink group-hover:text-blue-500">{shape.title}</h2>
        {shape.excerpt && <p className="text-muted-label mt-2 line-clamp-2 text-sm">{shape.excerpt}</p>}
      </div>
    </FeedLink>
  );
}

function GridCard({ item }: { item: LatestFeedItem }) {
  const shape = toCardShape(item);
  return (
    <FeedLink
      shape={shape}
      className="group block overflow-hidden rounded-lg border border-rule bg-paper transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <CardImage shape={shape} aspect="aspect-video" />
      <div className="p-4">
        <p className="text-eyebrow text-[10px] text-muted-label">{shape.eyebrow}</p>
        <h3 className="text-headline mt-1 text-base text-ink group-hover:text-blue-500">{shape.title}</h3>
      </div>
    </FeedLink>
  );
}

function ListRow({ item }: { item: LatestFeedItem }) {
  const shape = toCardShape(item);
  return (
    <FeedLink
      shape={shape}
      className="group flex gap-4 overflow-hidden rounded-lg border border-rule bg-paper transition hover:border-blue-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <div className="w-1.5 shrink-0" style={{ backgroundColor: shape.colorFallback }} />
      <div className="min-w-0 flex-1 py-4 pr-4">
        <p className="text-eyebrow text-[10px] text-muted-label">{shape.eyebrow}</p>
        <h3 className="text-headline mt-1 text-lg text-ink group-hover:text-blue-500">{shape.title}</h3>
        {shape.excerpt && <p className="text-muted-label mt-1 line-clamp-2 text-sm">{shape.excerpt}</p>}
      </div>
    </FeedLink>
  );
}

/**
 * Cuenta de items, no huecos de rejilla fijos — pedido explícito: con poco contenido,
 * una rejilla de tamaño fijo (como la de atptour.com, que asume publicación diaria)
 * dejaría huecos vacíos o forzados. Aquí el primero es un hero, hasta 4 más van en
 * rejilla, el resto en lista — y cualquiera de esas secciones se omite entera si no
 * hay items para ella, en vez de reservarle sitio.
 */
export function LatestFeed({ items }: { items: LatestFeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-12 text-center">Nothing published yet.</p>
    );
  }

  const [hero, ...rest] = items;
  const gridItems = rest.slice(0, 4);
  const listItems = rest.slice(4);

  return (
    <div className="space-y-4">
      <HeroCard item={hero} />
      {gridItems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {gridItems.map((item) => (
            <GridCard key={item.kind === "news" ? `news-${item.data.id}` : `video-${item.data.id}`} item={item} />
          ))}
        </div>
      )}
      {listItems.length > 0 && (
        <div className="space-y-4">
          {listItems.map((item) => (
            <ListRow key={item.kind === "news" ? `news-${item.data.id}` : `video-${item.data.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
