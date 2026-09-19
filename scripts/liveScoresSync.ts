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
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { liveScoresCache } from "../db/schema";
import { fetchLiveHtml } from "../lib/liveTennis/fetchLive";
import { parseLivePage } from "../lib/liveTennis/parseLivePage";
import { filterCandidates } from "../lib/liveTennis/filterCandidates";
import { loadKnownSurfaces } from "../lib/liveTennis/surfaces";
import { resolveAgainstOngoing, type LiveTourMatch } from "../lib/liveTennis/resolveAgainstOngoing";
import { buildFakeLiveMatch, FAKE_LIVE_MATCH_TOURNAMENT_NAME } from "../lib/liveTennis/fakeLiveMatch";
import { notifyNewlyLiveMatches } from "../lib/pushNotifications/notifyLiveMatches";

const INTERVAL_MS = 20_000;
const CACHE_ROW_ID = 1;

/**
 * Si un admin ha activado el partido de mentira (app/admin/scores/actions.ts::
 * toggleFakeLiveMatch, para probar la tira de "Live Now" sin esperar a uno real), este
 * ciclo de 20s lo pisaba sin más al escribir su propia foto real — quedaba visible como
 * mucho un segundo, tiempo justo hasta el siguiente ciclo (bug real, reportado
 * probando desde el móvil: "tried injecting, nothing appears"). Se conserva
 * re-añadiéndolo si sigue presente en la fila actual, mismo criterio inverso que ya
 * usa el propio toggle (que conserva los partidos reales al encender/apagar el suyo).
 */
async function withFakeMatchPreserved(realMatches: LiveTourMatch[]): Promise<LiveTourMatch[]> {
  const [row] = await db.select({ matches: liveScoresCache.matches }).from(liveScoresCache).where(eq(liveScoresCache.id, CACHE_ROW_ID));
  const fakeStillActive = ((row?.matches ?? []) as LiveTourMatch[]).some((m) => m.tournamentName === FAKE_LIVE_MATCH_TOURNAMENT_NAME);
  return fakeStillActive ? [...realMatches, buildFakeLiveMatch()] : realMatches;
}

async function syncOnce(): Promise<void> {
  try {
    const html = await fetchLiveHtml();
    const raw = parseLivePage(html);
    const candidates = filterCandidates(raw, loadKnownSurfaces());
    const realMatches = await resolveAgainstOngoing(candidates);
    const matches = await withFakeMatchPreserved(realMatches);

    await db
      .insert(liveScoresCache)
      .values({ id: CACHE_ROW_ID, matches, updatedAt: new Date() })
      .onConflictDoUpdate({ target: liveScoresCache.id, set: { matches, updatedAt: new Date() } });

    console.log(`✓ ${new Date().toISOString()} — ${realMatches.length} partido(s) en vivo`);

    // Aparte, en su propio try/catch — un fallo avisando a los seguidores nunca debe
    // impedir que el ciclo siga escribiendo la foto de "en directo" cada 20s.
    try {
      await notifyNewlyLiveMatches(matches);
    } catch (err) {
      console.error(`✗ ${new Date().toISOString()} — fallo avisando de partidos recién puestos en directo:`, err);
    }
  } catch (err) {
    console.error(`✗ ${new Date().toISOString()} — fallo, se mantiene la última foto buena:`, err);
  }
}

async function main() {
  await syncOnce();
  setInterval(syncOnce, INTERVAL_MS);
}

main();
