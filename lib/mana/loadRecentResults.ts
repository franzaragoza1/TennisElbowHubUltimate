/**
 * Carga puntual de `OT_LastResults.php` — el botón "Refresh" del panel de admin de
 * `/scores`. A diferencia de `loadTournament.ts` (reemplaza todo lo de una edición),
 * esto es ADITIVO: cada refresco inserta lo nuevo que la fuente muestre y deja
 * intacto lo que ya teníamos — la clave única (`reportedAt`+`winnerId`+`loserId`+
 * `round`) hace que repetir el refresco no duplique nada, así que el botón es seguro
 * de pulsar tantas veces como haga falta. No se borra nada: la propia página fuente
 * es una ventana de ~10 días que rota sola; borrar y reemplazar en cada refresco nos
 * dejaría con MENOS histórico del que ya hubiéramos acumulado.
 */
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, recentResults, recentResultSets, importRuns } from "@/db/schema";
import { parseLastResultsPage } from "@/parsers/lastResultsPage";
import { fetchLastResultsPageLive } from "./fetchLive";
import { ensureSource, loadPlayerMap, ensurePlayers } from "./loaders";

export interface LoadRecentResultsResult {
  totalParsed: number;
  inserted: number;
}

export async function loadRecentResults(): Promise<LoadRecentResultsResult> {
  const sourceId = await ensureSource();
  const startedAt = new Date();

  try {
    const { html } = await fetchLastResultsPageLive();
    const page = parseLastResultsPage(html);

    const playerRefs = new Map<string, string>();
    for (const r of page.results) {
      playerRefs.set(r.winner.externalId, r.winner.displayName);
      playerRefs.set(r.loser.externalId, r.loser.displayName);
      if (r.reporter) playerRefs.set(r.reporter.externalId, r.reporter.displayName);
    }
    const playerMap = await loadPlayerMap(sourceId);
    await ensurePlayers(sourceId, playerRefs, playerMap);

    // El Trn= ya viene en el propio enlace de cada fila (docs/estructura.md §4) — se
    // resuelve la edición directamente por él, nunca por nombre de torneo.
    const trnSet = [...new Set(page.results.map((r) => r.tournamentExternalId))];
    const editionRows =
      trnSet.length > 0
        ? await db
            .select({ id: editions.id, externalId: editions.externalId })
            .from(editions)
            .where(and(eq(editions.sourceId, sourceId), inArray(editions.externalId, trnSet)))
        : [];
    const editionIdByTrn = new Map(editionRows.map((e) => [e.externalId, e.id]));

    // Uno a uno, no en lote: hace falta el id devuelto de CADA fila para insertar sus
    // sets a continuación, y `onConflictDoNothing` en lote no garantiza qué filas del
    // lote se devuelven (las que chocan con la clave única simplemente no vuelven,
    // rompiendo la correspondencia por índice con el lote de entrada). El volumen por
    // refresco es pequeño (la propia fuente es una ventana de ~10 días), así que no
    // hace falta optimizar esto en lote.
    let inserted = 0;
    for (const r of page.results) {
      const [row] = await db
        .insert(recentResults)
        .values({
          sourceId,
          reportedAt: new Date(r.reportedAt),
          tournamentExternalId: r.tournamentExternalId,
          editionId: editionIdByTrn.get(r.tournamentExternalId) ?? null,
          tournamentName: r.tournamentName,
          competition: r.competition,
          round: r.round,
          winnerId: playerMap.get(r.winner.externalId)!.playerId,
          loserId: playerMap.get(r.loser.externalId)!.playerId,
          scoreRaw: r.scoreRaw,
          outcome: r.outcome,
          reporterId: r.reporter ? playerMap.get(r.reporter.externalId)!.playerId : null,
        })
        .onConflictDoNothing({
          target: [recentResults.reportedAt, recentResults.winnerId, recentResults.loserId, recentResults.round],
        })
        .returning({ id: recentResults.id });

      if (!row) continue; // ya lo teníamos de un refresco anterior
      inserted++;

      if (r.sets.length > 0) {
        await db.insert(recentResultSets).values(
          r.sets.map((s) => ({
            resultId: row.id,
            setNumber: s.setNumber,
            winnerGames: s.winnerGames,
            loserGames: s.loserGames,
            tiebreakLoserPoints: s.tiebreakLoserPoints,
          })),
        );
      }
    }

    await db.insert(importRuns).values({
      sourceId,
      kind: "scores",
      startedAt,
      finishedAt: new Date(),
      status: "success",
      filesProcessed: 1,
      rowsInserted: inserted,
      rowsSkipped: page.results.length - inserted,
    });

    return { totalParsed: page.results.length, inserted };
  } catch (err) {
    await db.insert(importRuns).values({
      sourceId,
      kind: "scores",
      startedAt,
      finishedAt: new Date(),
      status: "failed",
      filesProcessed: 0,
      rowsInserted: 0,
      rowsSkipped: 0,
      errors: [{ file: "OT_LastResults.php", message: err instanceof Error ? err.message : String(err) }],
    });
    throw err;
  }
}
