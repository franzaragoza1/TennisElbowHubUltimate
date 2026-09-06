/**
 * Extraído de `app/admin/news/actions.ts` (donde vivía sin exportarse) — el bot de
 * Discord también inserta filas en `news` al terminar una entrevista (ver
 * `lib/newsGeneration/facts.ts`, kind `post_match_interview`), y necesita el mismo
 * slug único que ya usa el flujo de generación manual del panel de admin.
 */
import { db } from "@/db/client";
import { news } from "@/db/schema";

export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function uniqueSlug(base: string, taken: Set<string>): Promise<string> {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Todos los slugs ya usados — para pasarle un `Set` fresco a `uniqueSlug` sin tener
 * que repetir esta consulta en cada llamador. */
export async function getTakenSlugs(): Promise<Set<string>> {
  return new Set((await db.select({ slug: news.slug }).from(news)).map((r) => r.slug));
}
