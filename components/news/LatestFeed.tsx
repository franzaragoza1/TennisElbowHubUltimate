"use client";

import { useState } from "react";
import Link from "next/link";
import { surfaceColor } from "@/lib/surfaceColors";
import { toDate, type LatestFeedItem } from "@/lib/latestFeed";
import { remoteImageSrc } from "@/lib/remoteImage";

export type { LatestFeedItem };

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
  /** Solo las noticias tienen firma — un vídeo de YouTube no tiene "autor" en el
   * sentido editorial, así que se deja en null y las tarjetas simplemente no pintan
   * el "By …" para ese caso, sin inventar nada. */
  author: string | null;
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
      author: s.author,
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
    author: null,
  };
}

/** "By {author}" arriba a la derecha, a la altura del eyebrow — pedido explícito
 * (2026-09-17). Fila propia en vez de meterlo dentro del propio texto del eyebrow
 * para que quede alineado al borde derecho de la tarjeta, no pegado al texto de la
 * izquierda. */
function CardByline({ author }: { author: string | null }) {
  if (!author) return null;
  return <span className="text-eyebrow shrink-0 text-[10px] text-muted-label">By {author}</span>;
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
        <img src={remoteImageSrc(shape.imageUrl, 400)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
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
        <div className="flex items-start justify-between gap-2">
          <p className="text-eyebrow text-[10px] text-muted-label">{shape.eyebrow}</p>
          <CardByline author={shape.author} />
        </div>
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
        <div className="flex items-start justify-between gap-2">
          <p className="text-eyebrow text-[10px] text-muted-label">{shape.eyebrow}</p>
          <CardByline author={shape.author} />
        </div>
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
        <div className="flex items-start justify-between gap-2">
          <p className="text-eyebrow text-[10px] text-muted-label">{shape.eyebrow}</p>
          <CardByline author={shape.author} />
        </div>
        <h3 className="text-headline mt-1 text-lg text-ink group-hover:text-blue-500">{shape.title}</h3>
        {shape.excerpt && <p className="text-muted-label mt-1 line-clamp-2 text-sm">{shape.excerpt}</p>}
      </div>
    </FeedLink>
  );
}

type FeedFilter = "all" | "news" | "video";

const TABS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "news", label: "News" },
  { id: "video", label: "Videos" },
];

/** Sin `?filter=` en la URL a propósito — pase de rendimiento de este mismo mes
 * (2026-09-14): leer `searchParams` fuerza SSR dinámico sin caché en toda la ruta,
 * con independencia de `export const revalidate`. Este filtro vive solo en estado de
 * cliente: cambiar de pestaña nunca vuelve a pedirle nada al servidor. */
function FeedTabs({ current, onChange }: { current: FeedFilter; onChange: (f: FeedFilter) => void }) {
  return (
    <div className="mb-4 flex gap-1 border-b border-rule">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`text-eyebrow -mb-px border-b-2 px-3 py-2 text-xs transition-colors ${
            current === tab.id ? "border-blue-500 text-ink" : "border-transparent text-muted-label hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const EMPTY_MESSAGE: Record<FeedFilter, string> = {
  all: "Nothing published yet.",
  news: "No news yet.",
  video: "No videos yet.",
};

/**
 * Cuenta de items, no huecos de rejilla fijos — pedido explícito: con poco contenido,
 * una rejilla de tamaño fijo (como la de atptour.com, que asume publicación diaria)
 * dejaría huecos vacíos o forzados. Aquí el primero es un hero, hasta 4 más van en
 * rejilla, el resto en lista — y cualquiera de esas secciones se omite entera si no
 * hay items para ella, en vez de reservarle sitio.
 *
 * Pestañas All/News/Videos (pedido explícito, 2026-09-17) — el pase anterior las
 * mezclaba todas juntas por defecto; ahora "All" sigue mezclando (mismo carril de
 * siempre), pero quien solo quiera una cosa puede pedirla sin más.
 */
export function LatestFeed({ items }: { items: LatestFeedItem[] }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const filtered = filter === "all" ? items : items.filter((item) => item.kind === filter);

  if (items.length === 0) {
    return (
      <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-12 text-center">Nothing published yet.</p>
    );
  }

  return (
    <div>
      <FeedTabs current={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-12 text-center">{EMPTY_MESSAGE[filter]}</p>
      ) : (
        <FeedList items={filtered} />
      )}
    </div>
  );
}

/**
 * Versión reducida del carril, sin pestañas ni hero — pedido explícito (2026-09-17):
 * "Player profiles shouldn't have a dedicated latest page, news should just appear in
 * overview, just smaller [and videos]". Sustituye a la pestaña "Latest" propia que
 * tenía la ficha de jugador (app/players/[id]/page.tsx): en vez de una sección aparte,
 * unas pocas filas compactas dentro de Overview — de ahí que no haya paginación ni
 * "ver más": si hiciera falta explorar el histórico completo de un jugador, esa
 * necesidad es rara y no justifica la complejidad de un enlace a ningún sitio (no
 * existe una URL propia de "noticias de este jugador" a la que mandar a nadie).
 */
export function CompactLatestList({ items, limit = 5 }: { items: LatestFeedItem[]; limit?: number }) {
  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-paper">
      {items.slice(0, limit).map((item) => {
        const shape = toCardShape(item);
        return (
          <FeedLink
            key={shape.key}
            shape={shape}
            className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-paper-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
          >
            <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded bg-paper-tint">
              {shape.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura pequeña, sin pipeline de next/image
                <img src={remoteImageSrc(shape.imageUrl, 56)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full" style={{ backgroundColor: shape.colorFallback }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow text-[9px] text-muted-label">{shape.eyebrow}</p>
              <p className="text-ink truncate text-sm font-medium group-hover:text-blue-500">{shape.title}</p>
            </div>
          </FeedLink>
        );
      })}
    </div>
  );
}

function FeedList({ items }: { items: LatestFeedItem[] }) {
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
