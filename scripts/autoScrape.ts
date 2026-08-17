/**
 * Cron local (Task Scheduler en Windows, ver docs/decisiones.md 2026-08-17): refresca
 * los torneos que están en juego AHORA MISMO y el ticker de resultados recientes, sin
 * que nadie tenga que tocar `/admin`. Pensado para correr desatendido cada 10 min.
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
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { loadTournamentByExternalId } from "../lib/mana/loadTournament";
import { loadRecentResults } from "../lib/mana/loadRecentResults";

const REQUEST_DELAY_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OngoingEdition {
  editionId: number;
  externalId: string;
}

/** Mismo criterio que `deriveTournamentStatus` (lib/tournamentStatus.ts) y la misma
 * consulta que ya usa `app/admin/tournaments/actions.ts::getRecentlyLoadedTournaments`,
 * sin el `ORDER BY ... LIMIT` (aquí hace falta la lista entera, no las últimas N). */
async function getOngoingEditions(): Promise<OngoingEdition[]> {
  const result = await db.execute(sql`
    SELECT e.id AS edition_id, e.external_id
    FROM editions e
    JOIN sources s ON s.id = e.source_id
    WHERE s.slug = 'mana'
      AND (
        EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes b WHERE b.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)
      )
      AND NOT EXISTS(SELECT 1 FROM matches mf WHERE mf.edition_id = e.id AND mf.round = 'F')
  `);
  const rows = (Array.isArray(result) ? result : result.rows) as { edition_id: number; external_id: string }[];
  return rows.map((r) => ({ editionId: Number(r.edition_id), externalId: r.external_id }));
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
  const ongoing = await getOngoingEditions();
  console.log(`Torneos en juego ahora mismo: ${ongoing.length}`);

  const touchedEditionIds: number[] = [];
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
