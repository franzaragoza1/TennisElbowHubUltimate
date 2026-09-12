/**
 * Calcula "qué hay en vivo ahora mismo" fuera de Vercel y lo deja en
 * `live_scores_cache` (db/schema.ts) — el trabajo real (parsear el HTML de
 * live-tennis.cn) es el mismo que antes hacía `app/api/live-scores/route.ts` en cada
 * ejecución; ahora esa ruta solo LEE esta fila. Ver el comentario de
 * `live_scores_cache` para el motivo (coste real de CPU en Vercel, confirmado en
 * Observability).
 *
 * A diferencia del scraper de Mana Games, `fetchLiveHtml()` usa `fetch()` normal —
 * live-tennis.cn no tiene el challenge anti-bot que obliga a Playwright, así que este
 * proceso no necesita Chromium ni `.playwright/`. Corre en el mismo servidor casero
 * (o donde sea) que el scraper/bot, como un tercer proceso propio con su propio ciclo
 * de 20s — mucho más corto que los 10 minutos de `autoScrape.ts`, así que no comparte
 * su bucle.
 *
 * Un fallo puntual (live-tennis.cn caído, detrás de su propio challenge esa vez, HTML
 * cambiado de forma) NUNCA borra la última foto buena — mejor enseñar datos de hace
 * 20s de más que un "Live Now" vacío por un fallo pasajero. Mismo criterio de fallo
 * silencioso que el resto de lib/liveTennis (nunca inventa un partido en vivo, nunca
 * tumba nada).
 *
 * Uso: npm run live-scores-sync
 */
import { db } from "../db/client";
import { liveScoresCache } from "../db/schema";
import { fetchLiveHtml } from "../lib/liveTennis/fetchLive";
import { parseLivePage } from "../lib/liveTennis/parseLivePage";
import { filterCandidates } from "../lib/liveTennis/filterCandidates";
import { loadKnownSurfaces } from "../lib/liveTennis/surfaces";
import { resolveAgainstOngoing } from "../lib/liveTennis/resolveAgainstOngoing";

const INTERVAL_MS = 20_000;
const CACHE_ROW_ID = 1;

async function syncOnce(): Promise<void> {
  try {
    const html = await fetchLiveHtml();
    const raw = parseLivePage(html);
    const candidates = filterCandidates(raw, loadKnownSurfaces());
    const matches = await resolveAgainstOngoing(candidates);

    await db
      .insert(liveScoresCache)
      .values({ id: CACHE_ROW_ID, matches, updatedAt: new Date() })
      .onConflictDoUpdate({ target: liveScoresCache.id, set: { matches, updatedAt: new Date() } });

    console.log(`✓ ${new Date().toISOString()} — ${matches.length} partido(s) en vivo`);
  } catch (err) {
    console.error(`✗ ${new Date().toISOString()} — fallo, se mantiene la última foto buena:`, err);
  }
}

async function main() {
  await syncOnce();
  setInterval(syncOnce, INTERVAL_MS);
}

main();
