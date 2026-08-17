/**
 * Cargador (fase 3, CLAUDE.md sección 5/7).
 *
 * Lee el HTML ya archivado por el backfill (data/raw/mana/), lo parsea, lo valida
 * (los parsers ya validan con Zod) y lo escribe en Postgres vía Drizzle, dejando
 * rastro en import_runs. Nunca aborta la pasada entera por un fichero suelto que
 * falle: lo cuenta como error y sigue con el siguiente.
 *
 * Uso: npm run load
 */
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { editions, matches, sets, byes, pendingSlots, editionRoundPoints, players, rankingSnapshots, importRuns } from "../db/schema";
import { parseTournamentPage } from "../parsers/tournamentPage";
import { parseRankingPage } from "../parsers/rankingPage";
import type { ParsedTournamentPage, ParsedRankingPage } from "../parsers/schemas";
import {
  CHUNK_SIZE,
  chunk,
  normalizeEventName,
  ensureSource,
  loadPlayerMap,
  ensurePlayers,
  loadEventMap,
  ensureEvents,
} from "../lib/mana/loaders";

const RAW_DIR = "data/raw/mana";

interface FileError {
  file: string;
  message: string;
}

interface LoadResult {
  filesProcessed: number;
  rowsInserted: number;
  rowsSkipped: number;
  errors: FileError[];
}

async function bulkUpdateCountry(entries: [playerId: number, country: string][]): Promise<void> {
  for (const batch of chunk(entries, CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    const valuesSql = sql.join(
      batch.map(([playerId, country]) => sql`(${playerId}::int, ${country}::text)`),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE ${players} AS p
      SET country = c.country
      FROM (VALUES ${valuesSql}) AS c(player_id, country)
      WHERE p.id = c.player_id
    `);
  }
}

async function loadTournaments(sourceId: number): Promise<LoadResult> {
  // Orden ascendente por ruta: la carpeta de fecha (`YYYY-MM-DD`) ordena bien como
  // texto, así que procesar en este orden y quedarse con la última entrada por
  // `externalId` (Map, la reescritura pisa la anterior) recoge siempre el archivo más
  // reciente cuando un mismo Trn= se ha vuelto a archivar en más de una fecha —
  // reparseo incremental normal según va avanzando un torneo (docs/decisiones.md).
  // Sin esto, un mismo Trn= duplicado en `parsed` hace que el UPSERT de más abajo
  // intente tocar la misma fila dos veces dentro de la misma sentencia y Postgres lo
  // rechaza ("ON CONFLICT DO UPDATE command cannot affect row a second time").
  const files = globSync(path.join(RAW_DIR, "**", "ot-viewtournament-*.html")).sort();
  const errors: FileError[] = [];
  const parsedByExternalId = new Map<string, ParsedTournamentPage>();

  for (const file of files) {
    const m = path.basename(file).match(/ot-viewtournament-trn-(\d+)\.html$/);
    if (!m) {
      errors.push({ file, message: "nombre de fichero inesperado" });
      continue;
    }
    const externalId = m[1];
    try {
      const html = readFileSync(file, "utf-8");
      const page = parseTournamentPage(html, externalId);
      if (page.matches.length === 0) {
        errors.push({ file, message: "sin partidos (Main Draw ausente)" });
        continue;
      }
      parsedByExternalId.set(externalId, page);
    } catch (err) {
      errors.push({ file, message: err instanceof Error ? err.message : String(err) });
    }
  }
  const parsed = [...parsedByExternalId.entries()].map(([externalId, page]) => ({ externalId, page }));

  const playerRefs = new Map<string, string>();
  for (const { page } of parsed) {
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
  }
  const playerMap = await loadPlayerMap(sourceId);
  await ensurePlayers(sourceId, playerRefs, playerMap);

  const eventRefs = new Map<string, string>();
  for (const { page } of parsed) {
    eventRefs.set(normalizeEventName(page.edition.eventName), page.edition.eventName);
  }
  const eventMap = await loadEventMap(sourceId);
  await ensureEvents(sourceId, eventRefs, eventMap);

  for (const batch of chunk(parsed, CHUNK_SIZE)) {
    const values = batch.map(({ externalId, page }) => {
      const eventEntry = eventMap.get(normalizeEventName(page.edition.eventName))!;
      return {
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
      };
    });
    await db
      .insert(editions)
      .values(values)
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
      });
  }

  const editionRows = await db
    .select({ id: editions.id, externalId: editions.externalId })
    .from(editions)
    .where(eq(editions.sourceId, sourceId));
  const editionIdByExternal = new Map(editionRows.map((r) => [r.externalId, r.id]));

  const editionIds = parsed
    .map(({ externalId }) => editionIdByExternal.get(externalId))
    .filter((id): id is number => id !== undefined);
  for (const batch of chunk(editionIds, CHUNK_SIZE)) {
    if (batch.length > 0) {
      await db.delete(matches).where(inArray(matches.editionId, batch));
      await db.delete(byes).where(inArray(byes.editionId, batch));
      await db.delete(pendingSlots).where(inArray(pendingSlots.editionId, batch));
      await db.delete(editionRoundPoints).where(inArray(editionRoundPoints.editionId, batch));
    }
  }

  let rowsInserted = 0;
  for (const { externalId, page } of parsed) {
    const editionId = editionIdByExternal.get(externalId);
    if (!editionId) continue;

    const matchRows = await db
      .insert(matches)
      .values(
        page.matches.map((m) => ({
          editionId,
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

    if (page.byes.length > 0) {
      await db.insert(byes).values(
        page.byes.map((b) => ({
          editionId,
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
          editionId,
          round: p.round,
          player1Id: p.player1 ? playerMap.get(p.player1.externalId)!.playerId : null,
          player2Id: p.player2 ? playerMap.get(p.player2.externalId)!.playerId : null,
          player1Seed: p.player1?.seed ?? null,
          player2Seed: p.player2?.seed ?? null,
          sortIndex: p.sortIndex,
        })),
      );
    }

    if (page.roundPoints.length > 0) {
      await db.insert(editionRoundPoints).values(
        page.roundPoints.map((rp) => ({
          editionId,
          round: rp.round,
          points: rp.points,
        })),
      );
    }

    rowsInserted += matchRows.length + page.byes.length + page.pending.length;
  }

  return { filesProcessed: parsed.length, rowsInserted, rowsSkipped: errors.length, errors };
}

/**
 * El nombre de fichero lo pone `slugify()` en backfill.ts a partir de la URL, así que
 * "...-race-1.html" es Race y "...-race-0.html" (o sin el sufijo) es el oficial de
 * siempre. Reutiliza `parseRankingPage` tal cual para las dos — de momento sin
 * confirmar contra una página Race real que la plantilla sea idéntica a la oficial
 * (ver docs/decisiones.md); si no lo es, esto falla alto y claro por fichero, nunca en
 * silencio, gracias a la validación Zod que ya trae el parser.
 */
function rankingKindFromFile(file: string): "official" | "race" {
  return path.basename(file).endsWith("-race-1.html") ? "race" : "official";
}

async function loadRankings(sourceId: number): Promise<LoadResult> {
  const files = globSync(path.join(RAW_DIR, "**", "ot-rankings-week-*.html"));
  const errors: FileError[] = [];
  const parsed: { kind: "official" | "race"; page: ParsedRankingPage }[] = [];

  for (const file of files) {
    try {
      const html = readFileSync(file, "utf-8");
      parsed.push({ kind: rankingKindFromFile(file), page: parseRankingPage(html) });
    } catch (err) {
      errors.push({ file, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const playerRefs = new Map<string, string>();
  const countryByExternalId = new Map<string, string>();
  for (const { page } of parsed) {
    for (const row of page.rows) {
      playerRefs.set(row.player.externalId, row.player.displayName);
      if (row.country) countryByExternalId.set(row.player.externalId, row.country);
    }
  }
  const playerMap = await loadPlayerMap(sourceId);
  await ensurePlayers(sourceId, playerRefs, playerMap);

  const allRows = parsed.flatMap(({ kind, page }) =>
    page.rows.map((row) => ({
      sourceId,
      kind,
      isoYear: page.isoYear,
      isoWeek: page.isoWeek,
      playerId: playerMap.get(row.player.externalId)!.playerId,
      rank: row.rank,
      points: row.points,
      moved: row.moved,
      smallTrn: row.smallTrn,
    })),
  );

  let rowsInserted = 0;
  for (const batch of chunk(allRows, CHUNK_SIZE)) {
    await db
      .insert(rankingSnapshots)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          rankingSnapshots.sourceId,
          rankingSnapshots.kind,
          rankingSnapshots.isoYear,
          rankingSnapshots.isoWeek,
          rankingSnapshots.playerId,
        ],
        set: {
          rank: sql`excluded.rank`,
          points: sql`excluded.points`,
          moved: sql`excluded.moved`,
          smallTrn: sql`excluded.small_trn`,
        },
      });
    rowsInserted += batch.length;
  }

  const countryEntries: [number, string][] = [...countryByExternalId.entries()].map(
    ([externalId, country]) => [playerMap.get(externalId)!.playerId, country],
  );
  await bulkUpdateCountry(countryEntries);

  return { filesProcessed: parsed.length, rowsInserted, rowsSkipped: errors.length, errors };
}

async function withImportRun(
  sourceId: number,
  kind: "tournament" | "ranking",
  fn: () => Promise<LoadResult>,
): Promise<void> {
  const [run] = await db
    .insert(importRuns)
    .values({ sourceId, kind, startedAt: new Date(), status: "success" })
    .returning({ id: importRuns.id });

  try {
    const result = await fn();
    const status =
      result.errors.length === 0 ? "success" : result.filesProcessed > 0 ? "partial" : "failed";
    await db
      .update(importRuns)
      .set({
        finishedAt: new Date(),
        status,
        filesProcessed: result.filesProcessed,
        rowsInserted: result.rowsInserted,
        rowsSkipped: result.rowsSkipped,
        errors: result.errors,
      })
      .where(eq(importRuns.id, run.id));

    console.log(
      `\n[${kind}] ${status}: ${result.filesProcessed} ficheros, ${result.rowsInserted} filas, ${result.rowsSkipped} saltados`,
    );
    if (result.errors.length > 0) {
      console.log(`  Errores (${result.errors.length}):`);
      for (const e of result.errors.slice(0, 20)) console.log(`   - ${e.file}: ${e.message}`);
      if (result.errors.length > 20) console.log(`   ... y ${result.errors.length - 20} más`);
    }
  } catch (err) {
    await db
      .update(importRuns)
      .set({
        finishedAt: new Date(),
        status: "failed",
        errors: [{ file: "-", message: err instanceof Error ? err.message : String(err) }],
      })
      .where(eq(importRuns.id, run.id));
    throw err;
  }
}

async function main() {
  const sourceId = await ensureSource();
  await withImportRun(sourceId, "tournament", () => loadTournaments(sourceId));
  await withImportRun(sourceId, "ranking", () => loadRankings(sourceId));
}

main()
  .then(() => {
    console.log("\n✅ Carga completa.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error fatal:", err);
    process.exit(1);
  });
