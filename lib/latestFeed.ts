import type { NewsCardData } from "@/lib/newsQueries";
import type { FeaturedVideo } from "@/lib/youtube/featured";

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
export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

/**
 * Mezcla noticias y vídeos en un único carril cronológico — pedido explícito
 * (2026-09-15): con el volumen de contenido real de este sitio, tres páginas
 * separadas (News/Videos/Interviews) se quedarían vacías la mayoría de las semanas;
 * juntas en un solo "Latest", un puñado de items ya se siente activo.
 *
 * Vive fuera de components/news/LatestFeed.tsx (un "use client" desde el pase de
 * pestañas, 2026-09-17) a propósito — Next.js no deja llamar una función exportada de
 * un módulo cliente directamente desde un Server Component ("Attempted to call
 * mergeChronologically() from the server but mergeChronologically is on the client"),
 * y las dos páginas que la usan (app/news/page.tsx, app/players/[id]/page.tsx) la
 * necesitan mientras todavía están en el servidor, antes de pasarle el resultado ya
 * mezclado a <LatestFeed> como prop.
 */
export function mergeChronologically(stories: NewsCardData[], videos: FeaturedVideo[]): LatestFeedItem[] {
  const items: (LatestFeedItem & { sortAt: number })[] = [
    ...stories.map((data) => ({ kind: "news" as const, data, sortAt: toDate(data.publishedAt)?.getTime() ?? 0 })),
    ...videos.map((data) => ({ kind: "video" as const, data, sortAt: toDate(data.publishedAt)?.getTime() ?? 0 })),
  ];
  items.sort((a, b) => b.sortAt - a.sortAt);
  return items;
}
