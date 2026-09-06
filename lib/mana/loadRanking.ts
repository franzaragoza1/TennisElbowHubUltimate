/**
 * Refresco puntual del ranking — botón "Refresh rankings" del panel de admin
 * (`/admin/rankings`). Comprueba qué semanas hay publicadas en el `<select
 * name="Week">` de `OT_Rankings.php` (Official y Race tienen calendarios de semana
 * independientes, ver docs/decisiones.md) y descarga/carga en vivo solo las que sean
 * más nuevas que la última semana ya importada de cada uno — ninguna, si ya estamos al
 * día. Seguro de pulsar tantas veces como se quiera: una semana ya cargada nunca
 * vuelve a pedirse.
 *
 * Hermano de `loadTournament.ts`/`loadRecentResults.ts`: mismo import perezoso de
 * `./fetchLive` (playwright no debe cargarse solo por importar este módulo, ver
 * docs/decisiones.md 2026-08-17) y misma limitación — solo funciona con el panel
 * corriendo en local, con Chromium disponible.
 */
import * as cheerio from "cheerio";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rankingSnapshots, importRuns } from "@/db/schema";
import { parseRankingPage } from "@/parsers/rankingPage";
import { ensureSource, loadPlayerMap, ensurePlayers, bulkUpdateCountry, chunk, CHUNK_SIZE } from "./loaders";
import { getLatestRankingWeek, getLatestRaceWeek, type IsoWeekRef } from "@/lib/tourQueries";

function weekKey(w: IsoWeekRef): number {
  return w.isoYear * 100 + w.isoWeek;
}

function parseWeekValue(raw: string): IsoWeekRef | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  return { isoYear: Number(m[1]), isoWeek: Number(m[2]) };
}

/** Valores del `<select name="Week">` de `OT_Rankings.php`, tal cual —
 * docs/estructura.md §2: formato `AAAA-WW`, sin ceros a la izquierda. */
function extractAvailableWeeks(html: string): IsoWeekRef[] {
  const $ = cheerio.load(html);
  const weeks: IsoWeekRef[] = [];
  $('select[name="Week"] option').each((_, el) => {
    const value = $(el).attr("value");
    const parsed = value ? parseWeekValue(value) : null;
    if (parsed) weeks.push(parsed);
  });
  return weeks;
}

export interface LoadedRankingWeek {
  isoYear: number;
  isoWeek: number;
  rows: number;
}

async function loadOneRankingWeek(
  sourceId: number,
  week: IsoWeekRef,
  kind: "official" | "race",
): Promise<LoadedRankingWeek> {
  const weekValue = `${week.isoYear}-${week.isoWeek}`;
  const startedAt = new Date();
  const label = `OT_Rankings.php?Week=${weekValue}&Race=${kind === "race" ? 1 : 0}`;

  try {
    const { fetchRankingWeekPageLive } = await import("./fetchLive");
    const { html } = await fetchRankingWeekPageLive(weekValue, kind);
    const page = parseRankingPage(html);

    const playerRefs = new Map<string, string>();
    const countryByExternalId = new Map<string, string>();
    for (const row of page.rows) {
      playerRefs.set(row.player.externalId, row.player.displayName);
      if (row.country) countryByExternalId.set(row.player.externalId, row.country);
    }
    const playerMap = await loadPlayerMap(sourceId);
    await ensurePlayers(sourceId, playerRefs, playerMap);

    const rows = page.rows.map((row) => ({
      sourceId,
      kind,
      isoYear: page.isoYear,
      isoWeek: page.isoWeek,
      playerId: playerMap.get(row.player.externalId)!.playerId,
      rank: row.rank,
      points: row.points,
      moved: row.moved,
      smallTrn: row.smallTrn,
    }));

    for (const batch of chunk(rows, CHUNK_SIZE)) {
      if (batch.length === 0) continue;
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
    }

    const countryEntries: [number, string][] = [...countryByExternalId.entries()].map(
      ([externalId, country]) => [playerMap.get(externalId)!.playerId, country],
    );
    await bulkUpdateCountry(countryEntries);

    await db.insert(importRuns).values({
      sourceId,
      kind: "ranking",
      startedAt,
      finishedAt: new Date(),
      status: "success",
      filesProcessed: 1,
      rowsInserted: rows.length,
      rowsSkipped: 0,
    });

    return { isoYear: page.isoYear, isoWeek: page.isoWeek, rows: rows.length };
  } catch (err) {
    await db.insert(importRuns).values({
      sourceId,
      kind: "ranking",
      startedAt,
      finishedAt: new Date(),
      status: "failed",
      filesProcessed: 0,
      rowsInserted: 0,
      rowsSkipped: 1,
      errors: [{ file: label, message: err instanceof Error ? err.message : String(err) }],
    });
    throw err;
  }
}

export interface RefreshRankingsResult {
  latestAvailableWeek: string | null;
  officialWeeksLoaded: LoadedRankingWeek[];
  raceWeeksLoaded: LoadedRankingWeek[];
}

/** Comprueba el desplegable de semanas en vivo y carga cada semana Official/Race más
 * nueva que la ya importada (`getLatestRankingWeek`/`getLatestRaceWeek`). Devuelve
 * listas vacías cuando no hay nada nuevo — no es un error, es el caso normal entre
 * publicaciones semanales del foro. */
export async function refreshLatestRankingWeeks(): Promise<RefreshRankingsResult> {
  const sourceId = await ensureSource();

  const { fetchRankingIndexPageLive } = await import("./fetchLive");
  const { html } = await fetchRankingIndexPageLive();
  const available = extractAvailableWeeks(html).sort((a, b) => weekKey(a) - weekKey(b));

  const [latestOfficial, latestRace] = await Promise.all([getLatestRankingWeek(), getLatestRaceWeek()]);

  const newOfficial = available.filter((w) => !latestOfficial || weekKey(w) > weekKey(latestOfficial));
  const newRace = available.filter((w) => !latestRace || weekKey(w) > weekKey(latestRace));

  const officialWeeksLoaded: LoadedRankingWeek[] = [];
  for (const w of newOfficial) {
    officialWeeksLoaded.push(await loadOneRankingWeek(sourceId, w, "official"));
  }

  const raceWeeksLoaded: LoadedRankingWeek[] = [];
  for (const w of newRace) {
    raceWeeksLoaded.push(await loadOneRankingWeek(sourceId, w, "race"));
  }

  const last = available[available.length - 1];
  return {
    latestAvailableWeek: last ? `${last.isoYear}-${last.isoWeek}` : null,
    officialWeeksLoaded,
    raceWeeksLoaded,
  };
}
