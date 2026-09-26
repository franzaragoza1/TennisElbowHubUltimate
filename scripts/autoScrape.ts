/**
 * Cron local (Task Scheduler en Windows, ver docs/decisiones.md 2026-08-17): refresca
 * los torneos que están en juego AHORA MISMO y el ticker de resultados recientes, sin
 * que nadie tenga que tocar `/admin`. Pensado para correr desatendido cada 10 min.
 *
 * También recoge lo que los botones de admin dejaron encolado mientras el panel
 * corría en Vercel (`processScrapeRequests`, ver lib/scrapeQueue.ts) — este es el
 * único proceso con Chromium real, así que es quien de verdad los ejecuta.
 *
 * A propósito NO descubre torneos nuevos (eso sigue siendo "Add tournament" a mano en
 * `/admin/tournaments`) — solo re-lee lo que ya está en la base de datos y sigue sin
 * ronda `F` resuelta. Descubrir torneos nuevos exigiría volver a scrapear el índice de
 * temporada con su propia cadencia; no compensa para algo que pasa un par de veces por
 * semana como mucho (docs/decisiones.md).
 *
 * `headless: true` en las dos llamadas de carga — comprobado en la práctica que, con
 * el perfil de `.playwright/` ya resuelto una vez, no hace falta ventana visible ni
 * una persona delante en cada pase (docs/decisiones.md). Si el challenge anti-bot
 * reaparece alguna vez, esta pasada en concreto falla (nadie headless puede resolverlo)
 * pero no rompe nada: queda registrado en `import_runs` igual que cualquier otro fallo,
 * y se resuelve a mano una vez, headed, como siempre.
 *
 * Uso: npm run autoscrape
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { scrapeRequests } from "../db/schema";
import { loadTournamentByExternalId } from "../lib/mana/loadTournament";
import { loadRecentResults } from "../lib/mana/loadRecentResults";
import { refreshLatestRankingWeeks } from "../lib/mana/loadRanking";
import { refreshPlayerProfiles } from "../lib/mana/loadPlayerProfiles";
import { acquireSingleInstanceLock } from "./lib/singleInstanceLock";

acquireSingleInstanceLock("autoScrape");

const REQUEST_DELAY_MS = 8_000;

/** Fichas de jugador que se leen por pasada (una petición cada 8 s) — pocas a propósito:
 * es un relleno lento y constante (países de jugadores nuevos, luego un refresco cada 60
 * días), no algo que deba alargar cada pasada. */
const PROFILES_PER_PASS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OngoingEdition {
  editionId: number;
  externalId: string;
}

/** Mismo criterio que `deriveTournamentStatus` (lib/tournamentStatus.ts) y la misma
 * consulta que ya usa `app/admin/tournaments/actions.ts::getRecentlyLoadedTournaments`,
 * sin el `ORDER BY ... LIMIT` (aquí hace falta la lista entera, no las últimas N).
 *
 * Antes exigía además que ya existiera ALGÚN partido/bye/hueco pendiente — pensado para
 * excluir a propósito los torneos todavía en registro (nada que releer ahí, ver
 * docs/estructura.md §3). Quitado (2026-09-18, pedido explícito): ahora esas mismas
 * ediciones sí traen algo real que actualizar (la cola de inscripción, ver
 * lib/mana/loadTournament.ts) y no hace falta un sondeo aparte — reusar este mismo
 * re-lector periódico las cubre solas. El único filtro que queda ("sin ronda F
 * resuelta") ya bastaba por sí mismo para excluir un torneo terminado; ahora también
 * incluye, sin ambigüedad, uno todavía sin cuadro. */
async function getOngoingEditions(): Promise<OngoingEdition[]> {
  const result = await db.execute(sql`
    SELECT e.id AS edition_id, e.external_id
    FROM editions e
    JOIN sources s ON s.id = e.source_id
    WHERE s.slug = 'mana'
      AND NOT EXISTS(SELECT 1 FROM matches mf WHERE mf.edition_id = e.id AND mf.round = 'F')
  `);
  const rows = (Array.isArray(result) ? result : result.rows) as { edition_id: number; external_id: string }[];
  return rows.map((r) => ({ editionId: Number(r.edition_id), externalId: r.external_id }));
}

/**
 * Recoge lo que los botones de admin dejaron encolado mientras corrían en Vercel (ver
 * lib/scrapeQueue.ts, db/schema.ts::scrapeRequests) — sin Chromium real ahí, solo
 * pueden pedirlo, esta es la máquina que de verdad lo ejecuta. Devuelve las ediciones
 * tocadas por peticiones de tipo 'tournament' para sumarlas al mismo aviso de
 * revalidación de la pasada rutinaria — un único webhook cubre las dos cosas.
 */
async function processScrapeRequests(): Promise<number[]> {
  const queued = await db.select().from(scrapeRequests).where(eq(scrapeRequests.status, "queued"));
  if (queued.length === 0) return [];
  console.log(`Peticiones encoladas desde el panel: ${queued.length}`);

  const touchedEditionIds: number[] = [];

  for (let i = 0; i < queued.length; i++) {
    const req = queued[i];
    await db.update(scrapeRequests).set({ status: "running", startedAt: new Date() }).where(eq(scrapeRequests.id, req.id));

    try {
      if (req.kind === "tournament") {
        if (!req.input) throw new Error("Petición de torneo sin Trn= — no se puede procesar.");
        const result = await loadTournamentByExternalId(req.input, { headless: true });
        touchedEditionIds.push(result.editionId);
        await db
          .update(scrapeRequests)
          .set({ status: "done", finishedAt: new Date(), resultEditionId: result.editionId })
          .where(eq(scrapeRequests.id, req.id));
        console.log(`✓ Petición #${req.id} (Trn=${req.input}) completada`);
      } else if (req.kind === "ranking") {
        const result = await refreshLatestRankingWeeks({ headless: true });
        await db.update(scrapeRequests).set({ status: "done", finishedAt: new Date() }).where(eq(scrapeRequests.id, req.id));
        console.log(`✓ Petición #${req.id} (rankings) completada — ${result.officialWeeksLoaded.length + result.raceWeeksLoaded.length} semanas nuevas`);
      } else if (req.kind === "scores") {
        const result = await loadRecentResults({ headless: true });
        await db.update(scrapeRequests).set({ status: "done", finishedAt: new Date() }).where(eq(scrapeRequests.id, req.id));
        console.log(`✓ Petición #${req.id} (scores) completada — ${result.inserted} nuevos`);
      } else {
        throw new Error(`kind desconocido: ${req.kind}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.update(scrapeRequests).set({ status: "failed", finishedAt: new Date(), error: message }).where(eq(scrapeRequests.id, req.id));
      console.log(`✗ Petición #${req.id} (${req.kind}) falló: ${message}`);
    }

    if (i < queued.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  return touchedEditionIds;
}

/** Avisa al sitio desplegado de que hay datos nuevos que servir — `revalidatePath`
 * solo existe dentro de un proceso de Next.js corriendo, y este script no lo es. Un
 * fallo aquí no debe tumbar la pasada: los datos ya están en la base de datos de
 * todas formas, el sitio los recoge solo en la próxima regeneración. */
async function notifySiteToRevalidate(editionIds: number[]): Promise<boolean> {
  const siteUrl = process.env.SITE_URL;
  const secret = process.env.SCRAPER_SECRET;
  if (!siteUrl || !secret) {
    console.log("⚠ SITE_URL o SCRAPER_SECRET sin configurar — se salta el aviso de revalidación.");
    return false;
  }
  try {
    const res = await fetch(`${siteUrl}/api/scraper/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ editionIds }),
    });
    if (!res.ok) {
      console.log(`✗ Revalidación falló: HTTP ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`✗ Revalidación falló: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  const touchedEditionIds = await processScrapeRequests();

  const ongoing = await getOngoingEditions();
  console.log(`Torneos en juego ahora mismo: ${ongoing.length}`);

  let failedCount = 0;

  for (let i = 0; i < ongoing.length; i++) {
    const { editionId, externalId } = ongoing[i];
    try {
      await loadTournamentByExternalId(externalId, { headless: true });
      touchedEditionIds.push(editionId);
      console.log(`✓ Trn=${externalId} (edición ${editionId}) actualizado`);
    } catch (err) {
      failedCount++;
      console.log(`✗ Trn=${externalId} (edición ${editionId}) falló: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (i < ongoing.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  let scoresOk = false;
  try {
    const result = await loadRecentResults({ headless: true });
    scoresOk = true;
    console.log(`✓ Scores: ${result.inserted} nuevos de ${result.totalParsed}`);
  } catch (err) {
    console.log(`✗ Scores falló: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const result = await refreshPlayerProfiles({ limit: PROFILES_PER_PASS, headless: true, delayMs: REQUEST_DELAY_MS });
    if (result.checked + result.failed > 0) {
      console.log(`✓ Fichas de jugador: ${result.checked} leídas, ${result.countriesSet} con país, ${result.failed} fallidas`);
    }
  } catch (err) {
    console.log(`✗ Fichas de jugador falló: ${err instanceof Error ? err.message : String(err)}`);
  }

  const revalidateOk = await notifySiteToRevalidate(touchedEditionIds);

  console.log(
    `Resumen: ${touchedEditionIds.length} torneos ok, ${failedCount} fallidos, ` +
      `scores ${scoresOk ? "ok" : "fallo"}, revalidate ${revalidateOk ? "ok" : "fallo"}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Error fatal:", err);
    process.exit(1);
  });
