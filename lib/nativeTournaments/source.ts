import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sources } from "@/db/schema";

/**
 * Torneos gestionados dentro de la propia web, no scrapeados de ningún sitio —
 * CLAUDE.md §3 ya dejaba hueco para esto ("más adelante nuestro propio torneo").
 * Mismo patrón que lib/mana/loaders.ts::ensureSource: select-antes-de-insert,
 * nunca sembrado desde una migración (las migraciones tocan estructura, no datos).
 */
export const NATIVE_SOURCE_SLUG = "te4tour";

export async function ensureNativeSource(): Promise<number> {
  const existing = await db.select().from(sources).where(eq(sources.slug, NATIVE_SOURCE_SLUG));
  if (existing.length > 0) return existing[0].id;
  const [row] = await db.insert(sources).values({ slug: NATIVE_SOURCE_SLUG, name: "TE4 Tour" }).returning({ id: sources.id });
  return row.id;
}
