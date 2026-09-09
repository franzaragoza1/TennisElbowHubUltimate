/**
 * Helpers de `news` compartidos entre el guardado de admin (app/admin/actions.ts::
 * saveNews) y el envío de un reportero (app/account/actions.ts::submitReporterStory)
 * — módulo aparte SIN "use server": un fichero "use server" exige que TODO export sea
 * una función async (bug real: `parsePlayerIds`/`slugify` vivían en
 * app/admin/actions.ts y rompían el build con "Server Actions must be async
 * functions" en cuanto otro fichero los importaba).
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

/** Añade un sufijo si el slug ya existe, para no chocar con el índice único. */
export async function uniqueSlug(base: string, excludeId: number | null): Promise<string> {
  const taken = await db.select({ id: news.id, slug: news.slug }).from(news);
  const inUse = new Set(taken.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!inUse.has(base)) return base;
  let n = 2;
  while (inUse.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function parsePlayerIds(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
}
