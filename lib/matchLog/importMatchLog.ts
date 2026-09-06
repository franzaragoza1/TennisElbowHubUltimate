/**
 * Orquesta la importación de uno o varios `MatchLog - *.html` subidos desde
 * `/admin/match-log` — parsea cada fichero, casa cada entrada `[Online]` contra un
 * partido real ya existente (`linkToTourMatch.ts`) y, si lo encuentra, rellena
 * `match_stats`. Todo lo que no se puede casar se cuenta y se registra como motivo,
 * nunca se descarta en silencio del todo (el admin necesita saber por qué). El HTML
 * de cada fichero se guarda en `match_log_files` para poder volver a procesarlo con
 * `refreshMatchLogFile` sin que el admin tenga que volver a subirlo.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { matchLogFiles, matchStats } from "@/db/schema";
import { parseMatchLogPage } from "@/parsers/matchLogPage";
import { buildNameIndex, findTourMatch } from "./linkToTourMatch";
import { resolvePlayerIdFromIndex, type NameIndex } from "./nameIndex";

const MAX_LOGGED_SKIPS = 100;

// Se repite en las dos filas del upsert (una por jugador) — mismo patrón que
// scripts/load.ts / lib/mana/loadRanking.ts: `excluded.columna` en vez de repetir el
// valor a mano, para que el UPDATE no se desincronice nunca del INSERT.
// `matchLogFileId` también se reescribe: si un `matchId`+`playerId` ya existía de un
// fichero anterior, pasa a atribuirse al fichero que se acaba de (re)procesar.
const UPDATE_SET = {
  matchLogFileId: sql`excluded.match_log_file_id`,
  aces: sql`excluded.aces`,
  doubleFaults: sql`excluded.double_faults`,
  firstServeAttempted: sql`excluded.first_serve_attempted`,
  firstServeIn: sql`excluded.first_serve_in`,
  firstServePointsPlayed: sql`excluded.first_serve_points_played`,
  firstServePointsWon: sql`excluded.first_serve_points_won`,
  secondServePointsPlayed: sql`excluded.second_serve_points_played`,
  secondServePointsWon: sql`excluded.second_serve_points_won`,
  breakPointsFaced: sql`excluded.break_points_faced`,
  breakPointsWon: sql`excluded.break_points_won`,
  returnPointsPlayed: sql`excluded.return_points_played`,
  returnPointsWon: sql`excluded.return_points_won`,
  netPointsPlayed: sql`excluded.net_points_played`,
  netPointsWon: sql`excluded.net_points_won`,
  winners: sql`excluded.winners`,
  forcedErrors: sql`excluded.forced_errors`,
  unforcedErrors: sql`excluded.unforced_errors`,
  totalPointsWon: sql`excluded.total_points_won`,
  fastestServeKmh: sql`excluded.fastest_serve_kmh`,
  avgFirstServeSpeedKmh: sql`excluded.avg_first_serve_speed_kmh`,
  avgSecondServeSpeedKmh: sql`excluded.avg_second_serve_speed_kmh`,
};

interface ProcessResult {
  totalOnlineEntries: number;
  linked: number;
  skipped: number;
  errors: string[];
  /** Nombres que no resolvieron contra nadie — no la ambigüedad de más de un
   * jugador con ese nombre exacto (eso también cuenta como "no resuelto" para el
   * import, pero no tiene sentido pedirle a la IA que sugiera un jugador cuando ya
   * hay más de uno con ese nombre exacto: el problema ahí no es encontrar un
   * candidato, es desambiguar). Deduplicado dentro de este fichero. */
  unresolvedNames: string[];
}

async function processFile(matchLogFileId: number, html: string, nameIndex: NameIndex): Promise<ProcessResult> {
  const { page, skipped: parseSkips } = parseMatchLogPage(html);
  const errors: string[] = [];
  for (const s of parseSkips) {
    if (errors.length < MAX_LOGGED_SKIPS) errors.push(`${s.reason}: ${s.raw}`);
  }

  let linked = 0;
  let skipped = parseSkips.length;
  const unresolvedNames = new Set<string>();

  for (const entry of page.entries) {
    const player1Id = resolvePlayerIdFromIndex(nameIndex, entry.player1Name);
    const player2Id = resolvePlayerIdFromIndex(nameIndex, entry.player2Name);
    if (!player1Id || !player2Id) {
      skipped++;
      const unresolved = !player1Id ? entry.player1Name : entry.player2Name;
      unresolvedNames.add(unresolved);
      if (errors.length < MAX_LOGGED_SKIPS) {
        errors.push(
          `${entry.player1Name} def. ${entry.player2Name}: "${unresolved}" is not a known tour player (or the name is ambiguous)`,
        );
      }
      continue;
    }

    const matchId = await findTourMatch(player1Id, player2Id, entry.sets, entry.playedAt);
    if (!matchId) {
      skipped++;
      if (errors.length < MAX_LOGGED_SKIPS) {
        errors.push(`${entry.player1Name} def. ${entry.player2Name}: no matching tour record found`);
      }
      continue;
    }

    await db
      .insert(matchStats)
      .values([
        { matchId, playerId: player1Id, matchLogFileId, ...entry.player1Stats },
        { matchId, playerId: player2Id, matchLogFileId, ...entry.player2Stats },
      ])
      .onConflictDoUpdate({ target: [matchStats.matchId, matchStats.playerId], set: UPDATE_SET });
    linked++;
  }

  return { totalOnlineEntries: page.entries.length, linked, skipped, errors, unresolvedNames: [...unresolvedNames] };
}

export interface MatchLogFileResult {
  fileId: number;
  fileName: string;
  totalOnlineEntries: number;
  linked: number;
  skipped: number;
}

export interface MatchLogImportSummary {
  results: MatchLogFileResult[];
  totalLinked: number;
  totalSkipped: number;
}

export async function importMatchLogFiles(
  files: { fileName: string; html: string }[],
  uploadedByUserId?: string,
): Promise<MatchLogImportSummary> {
  // Un único índice de nombres para todo el lote (no una consulta por nombre a
  // resolver, que serían cientos): los jugadores no cambian mientras se procesa una
  // subida, así que construirlo una vez es correcto y mucho más barato.
  const nameIndex = await buildNameIndex();
  const results: MatchLogFileResult[] = [];

  // Secuencial, no en paralelo: el volumen por fichero es de decenas/cientos de
  // entradas, no miles, y cada una hace varias idas y vueltas a la base de datos.
  for (const file of files) {
    const [row] = await db
      .insert(matchLogFiles)
      .values({ fileName: file.fileName, html: file.html, uploadedByUserId: uploadedByUserId ?? null })
      .returning({ id: matchLogFiles.id });

    const { totalOnlineEntries, linked, skipped, errors, unresolvedNames } = await processFile(row.id, file.html, nameIndex);
    await db
      .update(matchLogFiles)
      .set({ lastProcessedAt: new Date(), totalOnlineEntries, linked, skipped, errors, unresolvedNames })
      .where(eq(matchLogFiles.id, row.id));

    results.push({ fileId: row.id, fileName: file.fileName, totalOnlineEntries, linked, skipped });
  }

  return {
    results,
    totalLinked: results.reduce((sum, r) => sum + r.linked, 0),
    totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
  };
}

/**
 * "Refresh" en `/admin/match-log` — vuelve a procesar el HTML YA guardado de este
 * fichero, con el índice de nombres de AHORA (no el de cuando se subió). Pensado
 * para justo después de añadir un `player_known_names` nuevo: partidos que fallaron
 * la primera vez pueden resolver esta vez, sin que el admin tenga que volver a
 * localizar el fichero en su PC ni subirlo otra vez.
 */
export async function refreshMatchLogFile(fileId: number): Promise<MatchLogFileResult | null> {
  const [file] = await db.select().from(matchLogFiles).where(eq(matchLogFiles.id, fileId));
  if (!file) return null;

  const nameIndex = await buildNameIndex();
  const { totalOnlineEntries, linked, skipped, errors, unresolvedNames } = await processFile(fileId, file.html, nameIndex);

  await db
    .update(matchLogFiles)
    .set({ lastProcessedAt: new Date(), totalOnlineEntries, linked, skipped, errors, unresolvedNames })
    .where(eq(matchLogFiles.id, fileId));

  return { fileId, fileName: file.fileName, totalOnlineEntries, linked, skipped };
}
