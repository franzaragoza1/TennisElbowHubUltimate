/**
 * Carga puntual de UN torneo, en vivo, para el botón "Add tournament" del panel de
 * admin — hermano pequeño de `scripts/load.ts` (que relee HTML ya archivado en disco
 * en bloque). A diferencia del cargador masivo, este SÍ crea la edición cuando todavía
 * no tiene ningún partido (torneo en inscripción, "Main Draw" ausente): el cargador
 * masivo lo trata como error porque viene del archivo histórico, donde un torneo sin
 * jugar carece de interés; aquí es justo el caso que se quiere poder añadir (CLAUDE.md
 * no lo pedía, pero un torneo recién abierto en el foro es tan real como uno acabado).
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, matches, sets, byes, pendingSlots, importRuns } from "@/db/schema";
import { parseTournamentPage } from "@/parsers/tournamentPage";
import { ensureSource, loadPlayerMap, ensurePlayers, loadEventMap, ensureEvents, normalizeEventName } from "./loaders";
import { deriveTournamentStatus, type TournamentStatus } from "@/lib/tournamentStatus";
export { parseTrnInput } from "./trn";

export interface LoadTournamentResult {
  editionId: number;
  eventName: string;
  year: number;
  isoWeek: number | null;
  status: TournamentStatus;
  matchCount: number;
  wasNewEdition: boolean;
}

export async function loadTournamentByExternalId(
  externalId: string,
  options?: { headless?: boolean },
): Promise<LoadTournamentResult> {
  const sourceId = await ensureSource();
  const startedAt = new Date();

  try {
    // Import perezoso a propósito (2026-08-17, docs/decisiones.md): `./fetchLive`
    // carga `playwright`, que solo existe para correr en local — un `import` normal
    // arriba del fichero cargaría ese módulo entero (y con él `playwright`) en cuanto
    // alguien importe `loadTournamentByExternalId`, aunque nunca llegue a invocarse.
    // Con `/admin/tournaments` dando 500 en producción, esto asegura que ni siquiera
    // ENTRAR en la página toca `playwright` — solo pulsar "Add tournament" de verdad.
    const { fetchTournamentPageLive } = await import("./fetchLive");
    const { html } = await fetchTournamentPageLive(externalId, options?.headless);
    const page = parseTournamentPage(html, externalId);

    const playerRefs = new Map<string, string>();
    for (const m of page.matches) {
      playerRefs.set(m.player1.externalId, m.player1.displayName);
      playerRefs.set(m.player2.externalId, m.player2.displayName);
    }
    for (const b of page.byes) {
      playerRefs.set(b.player.externalId, b.player.displayName);
    }
    for (const p of page.pending) {
      if (p.player1) playerRefs.set(p.player1.externalId, p.player1.displayName);
      if (p.player2) playerRefs.set(p.player2.externalId, p.player2.displayName);
    }
    const playerMap = await loadPlayerMap(sourceId);
    await ensurePlayers(sourceId, playerRefs, playerMap);

    const normalizedName = normalizeEventName(page.edition.eventName);
    const eventMap = await loadEventMap(sourceId);
    await ensureEvents(sourceId, new Map([[normalizedName, page.edition.eventName]]), eventMap);
    const eventEntry = eventMap.get(normalizedName)!;

    const existing = await db
      .select({ id: editions.id })
      .from(editions)
      .where(and(eq(editions.sourceId, sourceId), eq(editions.externalId, externalId)));
    const wasNewEdition = existing.length === 0;

    const [editionRow] = await db
      .insert(editions)
      .values({
        eventId: eventEntry.id,
        sourceId,
        externalId,
        year: page.edition.year,
        isoWeek: page.edition.isoWeek,
        weekStartDate: page.edition.weekStartDate,
        surface: page.edition.surface,
        category: page.edition.category,
        competition: page.edition.competition,
        drawSize: page.edition.drawSize,
        queueCount: page.edition.queueCount,
        queueCapacity: page.edition.queueCapacity,
        seeds: page.edition.seeds,
        officialTopicUrl: page.edition.officialTopicUrl,
      })
      .onConflictDoUpdate({
        target: [editions.sourceId, editions.externalId],
        set: {
          eventId: sql`excluded.event_id`,
          year: sql`excluded.year`,
          isoWeek: sql`excluded.iso_week`,
          weekStartDate: sql`excluded.week_start_date`,
          surface: sql`excluded.surface`,
          category: sql`excluded.category`,
          competition: sql`excluded.competition`,
          drawSize: sql`excluded.draw_size`,
          queueCount: sql`excluded.queue_count`,
          queueCapacity: sql`excluded.queue_capacity`,
          seeds: sql`excluded.seeds`,
          officialTopicUrl: sql`excluded.official_topic_url`,
        },
      })
      .returning({ id: editions.id });

    // El torneo puede haber avanzado desde la última carga (más rondas jugadas) o,
    // más raro, haberse corregido un resultado — se reemplazan todos sus partidos,
    // byes y huecos pendientes en vez de intentar un diff parcial, igual que hace el
    // cargador masivo.
    await db.delete(matches).where(eq(matches.editionId, editionRow.id));
    await db.delete(byes).where(eq(byes.editionId, editionRow.id));
    await db.delete(pendingSlots).where(eq(pendingSlots.editionId, editionRow.id));

    if (page.matches.length > 0) {
      const matchRows = await db
        .insert(matches)
        .values(
          page.matches.map((m) => ({
            editionId: editionRow.id,
            round: m.round,
            player1Id: playerMap.get(m.player1.externalId)!.playerId,
            player2Id: playerMap.get(m.player2.externalId)!.playerId,
            player1Seed: m.player1.seed ?? null,
            player2Seed: m.player2.seed ?? null,
            winnerId: playerMap.get(m.winnerExternalId)!.playerId,
            outcome: m.outcome,
            scoreRaw: m.scoreRaw,
            sortIndex: m.sortIndex,
          })),
        )
        .returning({ id: matches.id });

      const setRows = page.matches.flatMap((m, i) =>
        m.sets.map((s) => ({
          matchId: matchRows[i].id,
          setNumber: s.setNumber,
          winnerGames: s.winnerGames,
          loserGames: s.loserGames,
          tiebreakLoserPoints: s.tiebreakLoserPoints,
        })),
      );
      if (setRows.length > 0) await db.insert(sets).values(setRows);
    }

    if (page.byes.length > 0) {
      await db.insert(byes).values(
        page.byes.map((b) => ({
          editionId: editionRow.id,
          round: b.round,
          playerId: playerMap.get(b.player.externalId)!.playerId,
          seed: b.player.seed ?? null,
          sortIndex: b.sortIndex,
        })),
      );
    }

    if (page.pending.length > 0) {
      await db.insert(pendingSlots).values(
        page.pending.map((p) => ({
          editionId: editionRow.id,
          round: p.round,
          player1Id: p.player1 ? playerMap.get(p.player1.externalId)!.playerId : null,
          player2Id: p.player2 ? playerMap.get(p.player2.externalId)!.playerId : null,
          player1Seed: p.player1?.seed ?? null,
          player2Seed: p.player2?.seed ?? null,
          sortIndex: p.sortIndex,
        })),
      );
    }

    await db.insert(importRuns).values({
      sourceId,
      kind: "tournament",
      startedAt,
      finishedAt: new Date(),
      status: "success",
      filesProcessed: 1,
      rowsInserted: page.matches.length + page.byes.length + page.pending.length,
      rowsSkipped: 0,
    });

    return {
      editionId: editionRow.id,
      eventName: page.edition.eventName,
      year: page.edition.year,
      isoWeek: page.edition.isoWeek,
      status: deriveTournamentStatus(page.matches, page.matches.length + page.byes.length + page.pending.length > 0),
      matchCount: page.matches.length,
      wasNewEdition,
    };
  } catch (err) {
    await db.insert(importRuns).values({
      sourceId,
      kind: "tournament",
      startedAt,
      finishedAt: new Date(),
      status: "failed",
      filesProcessed: 0,
      rowsInserted: 0,
      rowsSkipped: 1,
      errors: [{ file: `Trn=${externalId}`, message: err instanceof Error ? err.message : String(err) }],
    });
    throw err;
  }
}
