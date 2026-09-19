/**
 * Mismo patrón que lib/newsSlug.ts, aplicado a discussion_topics — módulo aparte SIN
 * "use server" por el mismo motivo (un fichero "use server" exige que todo export sea
 * una función async, y `slugify` no lo es). `slugify` en sí vive en lib/topicSlugify.ts,
 * sin ninguna dependencia — así se puede probar con Vitest sin arrastrar `@/db/client`
 * (que sí hace falta aquí, para `uniqueSlug`, pero rompe la resolución de alias `@/` de
 * Vitest si un test lo importa).
 */
import { db } from "@/db/client";
import { discussionTopics } from "@/db/schema";

export { slugify } from "./topicSlugify";

/** Añade un sufijo si el slug ya existe, para no chocar con el índice único. */
export async function uniqueSlug(base: string, excludeId: number | null): Promise<string> {
  const taken = await db.select({ id: discussionTopics.id, slug: discussionTopics.slug }).from(discussionTopics);
  const inUse = new Set(taken.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!inUse.has(base)) return base;
  let n = 2;
  while (inUse.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
