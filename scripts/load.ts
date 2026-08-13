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
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  sources,
  players,
  playerAliases,
  events,
  editions,
  matches,
  sets,
  rankingSnapshots,
  importRuns,
} from "../db/schema";
import { parseTournamentPage } from "../parsers/tournamentPage";
import { parseRankingPage } from "../parsers/rankingPage";
import type { ParsedTournamentPage, ParsedRankingPage } from "../parsers/schemas";

const SOURCE_SLUG = "mana";
const RAW_DIR = "data/raw/mana";
const CHUNK_SIZE = 500;

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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normalizeEventName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function ensureSource(): Promise<number> {
  const existing = await db.select().from(sources).where(eq(sources.slug, SOURCE_SLUG));
  if (existing.length > 0) return existing[0].id;
  const [row] = await db
    .insert(sources)
    .values({ slug: SOURCE_SLUG, name: "Mana Games" })
    .returning({ id: sources.id });
  return row.id;
}

interface PlayerMapEntry {
  playerId: number;
  displayName: string;
}

async function loadPlayerMap(sourceId: number): Promise<Map<string, PlayerMapEntry>> {
  const rows = await db
    .select({
      externalId: playerAliases.externalId,
      playerId: playerAliases.playerId,
      displayName: playerAliases.displayName,
    })
    .from(playerAliases)
    .where(eq(playerAliases.sourceId, sourceId));
  const map = new Map<string, PlayerMapEntry>();
  for (const r of rows) map.set(r.externalId, { playerId: r.playerId, displayName: r.displayName });
  return map;
}

/** Crea jugadores/alias nuevos en bloque para externalId no vistos. Actualiza `map` in place. */
async function ensurePlayers(
  sourceId: number,
  refs: Map<string, string>,
  map: Map<string, PlayerMapEntry>,
): Promise<void> {
  const toCreate = [...refs.entries()].filter(([externalId]) => !map.has(externalId));

  for (const batch of chunk(toCreate, CHUNK_SIZE)) {
    const newPlayers = await db
      .insert(players)
      .values(batch.map(([, displayName]) => ({ displayName })))
      .returning({ id: players.id });
    const aliasRows = batch.map(([externalId, displayName], i) => ({
      playerId: newPlayers[i].id,
      sourceId,
      externalId,
      displayName,
    }));
    await db.insert(playerAliases).values(aliasRows);
    batch.forEach(([externalId, displayName], i) => {
      map.set(externalId, { playerId: newPlayers[i].id, displayName });
    });
  }

  // Nombre visible cambiado para un jugador ya conocido: poco frecuente, uno a uno.
  for (const [externalId, displayName] of refs) {
    const entry = map.get(externalId);
    if (entry && entry.displayName !== displayName) {
      await db
        .update(playerAliases)
        .set({ displayName })
        .where(and(eq(playerAliases.sourceId, sourceId), eq(playerAliases.externalId, externalId)));
      await db.update(players).set({ displayName }).where(eq(players.id, entry.playerId));
      entry.displayName = displayName;
    }
  }
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

interface EventMapEntry {
  id: number;
  displayName: string;
}

async function loadEventMap(sourceId: number): Promise<Map<string, EventMapEntry>> {
  const rows = await db.select().from(events).where(eq(events.sourceId, sourceId));
  const map = new Map<string, EventMapEntry>();
  for (const r of rows) map.set(r.normalizedName, { id: r.id, displayName: r.displayName });
  return map;
}

async function ensureEvents(
  sourceId: number,
  refs: Map<string, string>,
  map: Map<string, EventMapEntry>,
): Promise<void> {
  const toCreate = [...refs.entries()].filter(([norm]) => !map.has(norm));

  for (const batch of chunk(toCreate, CHUNK_SIZE)) {
    const rows = await db
      .insert(events)
      .values(batch.map(([normalizedName, displayName]) => ({ sourceId, normalizedName, displayName })))
      .returning({ id: events.id, normalizedName: events.normalizedName });
    rows.forEach((r, i) => map.set(r.normalizedName, { id: r.id, displayName: batch[i][1] }));
  }

  for (const [normalizedName, displayName] of refs) {
    const entry = map.get(normalizedName);
    if (entry && entry.displayName !== displayName) {
      await db.update(events).set({ displayName }).where(eq(events.id, entry.id));
      entry.displayName = displayName;
    }
  }
}

async function loadTournaments(sourceId: number): Promise<LoadResult> {
  const files = globSync(path.join(RAW_DIR, "**", "ot-viewtournament-*.html"));
  const errors: FileError[] = [];
  const parsed: { externalId: string; page: ParsedTournamentPage }[] = [];

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
      parsed.push({ externalId, page });
    } catch (err) {
      errors.push({ file, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const playerRefs = new Map<string, string>();
  for (const { page } of parsed) {
    for (const m of page.matches) {
      playerRefs.set(m.player1.externalId, m.player1.displayName);
      playerRefs.set(m.player2.externalId, m.player2.displayName);
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
    if (batch.length > 0) await db.delete(matches).where(inArray(matches.editionId, batch));
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

    rowsInserted += matchRows.length;
  }

  return { filesProcessed: parsed.length, rowsInserted, rowsSkipped: errors.length, errors };
}

async function loadRankings(sourceId: number): Promise<LoadResult> {
  const files = globSync(path.join(RAW_DIR, "**", "ot-rankings-week-*.html"));
  const errors: FileError[] = [];
  const parsed: ParsedRankingPage[] = [];

  for (const file of files) {
    try {
      const html = readFileSync(file, "utf-8");
      parsed.push(parseRankingPage(html));
    } catch (err) {
      errors.push({ file, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const playerRefs = new Map<string, string>();
  const countryByExternalId = new Map<string, string>();
  for (const page of parsed) {
    for (const row of page.rows) {
      playerRefs.set(row.player.externalId, row.player.displayName);
      if (row.country) countryByExternalId.set(row.player.externalId, row.country);
    }
  }
  const playerMap = await loadPlayerMap(sourceId);
  await ensurePlayers(sourceId, playerRefs, playerMap);

  const allRows = parsed.flatMap((page) =>
    page.rows.map((row) => ({
      sourceId,
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
