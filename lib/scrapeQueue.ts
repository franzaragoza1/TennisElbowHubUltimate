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

/**
 * Bug real, corregido 2026-09-24: esto comprobaba `process.env.VERCEL`, que Vercel
 * ponía automáticamente en todos sus entornos — pero la web se mudó a Render hace
 * tiempo (ver docs/decisiones.md) y nadie actualizó esto. `VERCEL` nunca estuvo
 * presente en Render, así que `needsQueueing()` llevaba devolviendo `false` en
 * producción desde la propia migración: los tres botones de admin que necesitan
 * Chromium real (Add/Refresh tournament, Refresh rankings, Refresh scores) llevaban
 * ese tiempo intentando escrapear DIRECTAMENTE desde el propio proceso de Render
 * — que nunca tuvo Chromium real instalado a propósito (`PLAYWRIGHT_SKIP_BROWSER_
 * DOWNLOAD=1` en render.yaml) — así que fallaban con un error en vez de encolarse.
 *
 * `RENDER` es el equivalente exacto de `VERCEL`: Render lo pone automáticamente en
 * todos sus servicios desplegados, nunca en local ni en el servidor siempre-vivo
 * (antes casero, ahora Oracle Cloud) — la misma frontera que hacía falta, sin
 * variable de entorno nueva que mantener.
 *
 * 2026-10-17: la web salió de Render (ahora corre en el servidor de Oracle, en un
 * contenedor sin Chromium) y `RENDER` dejó de existir: los botones de admin intentaban
 * lanzar Chromium en el propio contenedor web y fallaban ("Executable doesn't exist at
 * …/chromium-1234/chrome-linux/chrome"). El servicio `web` de docker-compose.yml pone
 * `QUEUE_SCRAPE_REQUESTS=1` — la misma frontera, ahora explícita — y el scraper, que sí
 * tiene Chromium, no la pone.
 */
export function needsQueueing(): boolean {
  return Boolean(process.env.RENDER || process.env.QUEUE_SCRAPE_REQUESTS);
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
