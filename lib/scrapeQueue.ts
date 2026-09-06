/**
 * Encola una petición de scraping para que `scripts/autoScrape.ts` la recoja en su
 * siguiente pasada — usado por los tres botones de admin que necesitan Chromium real
 * (Add/Refresh tournament, Refresh rankings, Refresh scores) cuando corren en Vercel,
 * donde eso no existe (ver comentario de `scrapeRequests` en db/schema.ts).
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { scrapeRequests } from "@/db/schema";

export type ScrapeRequestKind = "tournament" | "ranking" | "scores";

const OPEN_STATUSES = ["queued", "running"] as const;

/** `VERCEL` lo pone Vercel automáticamente en todos sus entornos (producción y
 * preview) y nunca está presente en local ni en el servidor casero — exactamente la
 * frontera que hace falta, sin necesidad de una variable de entorno nueva. */
export function needsQueueing(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * Si ya hay una petición del mismo tipo (y mismo `input`, para torneos) esperando o en
 * marcha, no añade una segunda — evita que pulsar el botón varias veces mientras el
 * servidor casero está desconectado amontone peticiones repetidas. Devuelve si la
 * petición encolada era nueva o ya existía.
 */
export async function queueScrapeRequest(kind: ScrapeRequestKind, input: string | null): Promise<{ alreadyQueued: boolean }> {
  const existing = await db
    .select({ id: scrapeRequests.id })
    .from(scrapeRequests)
    .where(
      and(
        eq(scrapeRequests.kind, kind),
        input === null ? isNull(scrapeRequests.input) : eq(scrapeRequests.input, input),
        inArray(scrapeRequests.status, OPEN_STATUSES),
      ),
    )
    .limit(1);

  if (existing.length > 0) return { alreadyQueued: true };

  await db.insert(scrapeRequests).values({ kind, input });
  return { alreadyQueued: false };
}
