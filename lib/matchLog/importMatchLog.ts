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
import { mapWithConcurrency } from "@/lib/concurrency";
import { buildNameIndex, findTourMatch } from "./linkToTourMatch";
import { resolvePlayerIdFromIndex, type NameIndex } from "./nameIndex";

const MAX_LOGGED_SKIPS = 100;

// Cuántas entradas de UN fichero se resuelven contra `matches` a la vez —
// `findTourMatch` es una petición HTTP independiente por entrada (`neon-http`, sin
// conexión con estado que compartir, ver db/client.ts), así que lanzarlas en paralelo
// con un tope reduce la latencia total del fichero de "N idas y vueltas seguidas" a
// "N/CONCURRENCY idas y vueltas", sin abrir un número de peticiones sin límite si el
// fichero trae cientos de entradas.
const MATCH_LOOKUP_CONCURRENCY = 8;

// Cuántas filas de `match_stats` se escriben por INSERT — un solo `.values([...])`
// para el fichero entero también funcionaría (decenas/cientos de entradas, nunca
// miles, ver el comentario de más abajo), pero un tope evita una sola sentencia
// gigante si algún fichero resultara excepcionalmente grande.
const STATS_INSERT_CHUNK_SIZE = 200;

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

type StatsRow = typeof matchStats.$inferInsert;

// Resultado de casar UNA entrada `[Online]` contra el tour real — nunca escribe en la
// base de datos por su cuenta, solo lo decide, para poder lanzar esto en paralelo
// entre entradas y dejar el `insert` real como un único paso batched al final del
// fichero (ver processFile).
type EntryOutcome = { kind: "linked"; rows: [StatsRow, StatsRow] } | { kind: "unresolved"; name: string } | { kind: "unmatched" };

async function resolveEntry(
  entry: ReturnType<typeof parseMatchLogPage>["page"]["entries"][number],
  nameIndex: NameIndex,
  matchLogFileId: number,
): Promise<EntryOutcome> {
  const player1Id = resolvePlayerIdFromIndex(nameIndex, entry.player1Name);
  const player2Id = resolvePlayerIdFromIndex(nameIndex, entry.player2Name);
  if (!player1Id || !player2Id) {
    return { kind: "unresolved", name: !player1Id ? entry.player1Name : entry.player2Name };
  }

  // Con un separador de cabecera de orden ambiguo ("vs", ver
  // parsers/matchLogPage.ts) no se sabe todavía quién ganó de verdad — se prueban las
  // dos combinaciones contra el tour real y se acepta la que encuentre un partido de
  // verdad. `findTourMatch` ya exige marcador EXACTO y ganador real, así que como
  // mucho una de las dos puede encontrar algo — nunca se adivina, se deja que el
  // propio dato del tour decida.
  let matchId = await findTourMatch(player1Id, player2Id, entry.sets, entry.playedAt);
  let winnerId = player1Id;
  let loserId = player2Id;
  let winnerStats = entry.player1Stats;
  let loserStats = entry.player2Stats;

  if (!matchId && entry.winnerOrderAmbiguous) {
    matchId = await findTourMatch(player2Id, player1Id, entry.sets, entry.playedAt);
    if (matchId) {
      winnerId = player2Id;
      loserId = player1Id;
      winnerStats = entry.player2Stats;
      loserStats = entry.player1Stats;
    }
  }

  if (!matchId) return { kind: "unmatched" };

  return {
    kind: "linked",
    rows: [
      { matchId, playerId: winnerId, matchLogFileId, ...winnerStats },
      { matchId, playerId: loserId, matchLogFileId, ...loserStats },
    ],
  };
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

  // Cada entrada se resuelve de forma independiente — se lanzan con un tope de
  // concurrencia (ver MATCH_LOOKUP_CONCURRENCY) en vez de una tras otra, que era el
  // verdadero coste de subir un fichero grande.
  const outcomes = await mapWithConcurrency(page.entries, MATCH_LOOKUP_CONCURRENCY, (entry) =>
    resolveEntry(entry, nameIndex, matchLogFileId),
  );

  const statsRows: StatsRow[] = [];
  page.entries.forEach((entry, i) => {
    const outcome = outcomes[i];
    if (outcome.kind === "unresolved") {
      skipped++;
      unresolvedNames.add(outcome.name);
      if (errors.length < MAX_LOGGED_SKIPS) {
        errors.push(`${entry.player1Name} def. ${entry.player2Name}: "${outcome.name}" is not a known tour player (or the name is ambiguous)`);
      }
      return;
    }
    if (outcome.kind === "unmatched") {
      skipped++;
      if (errors.length < MAX_LOGGED_SKIPS) {
        errors.push(`${entry.player1Name} def. ${entry.player2Name}: no matching tour record found`);
      }
      return;
    }
    statsRows.push(...outcome.rows);
    linked++;
  });

  // Deduplicado por (matchId, playerId) ANTES de insertar — Postgres rechaza un
  // "ON CONFLICT DO UPDATE" que afecte a la misma fila dos veces DENTRO de la misma
  // sentencia ("cannot affect row a second time"), y un MatchLog real puede traer más
  // de una entrada [Online] que case con el MISMO partido del tour (un jugador puede
  // exportar el log varias veces cubriendo el mismo periodo, o repetir/revisar un
  // partido ya jugado). Antes de este batching cada entrada se insertaba en su propia
  // sentencia SECUENCIAL, así que un duplicado simplemente pisaba al anterior sin
  // problema (bug real reportado al agrupar varias filas en un solo INSERT, "cannot
  // affect row a second time" via NeonDbError) — quedarse con la ÚLTIMA aparición
  // conserva ese mismo comportamiento.
  const dedupedRows = new Map<string, StatsRow>();
  for (const row of statsRows) dedupedRows.set(`${row.matchId}:${row.playerId}`, row);
  const rowsToInsert = [...dedupedRows.values()];

  // Un solo INSERT por tramo de filas en vez de uno por entrada — decenas/cientos de
  // entradas por fichero (nunca miles, ver decodeUpload.ts), así que esto es como
  // mucho un puñado de idas y vueltas, no cientos.
  for (let i = 0; i < rowsToInsert.length; i += STATS_INSERT_CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + STATS_INSERT_CHUNK_SIZE);
    await db.insert(matchStats).values(chunk).onConflictDoUpdate({ target: [matchStats.matchId, matchStats.playerId], set: UPDATE_SET });
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

  // Los FICHEROS siguen procesándose uno detrás de otro (el orden de inserción de
  // `match_log_files` importa para "más reciente primero" en la UI), pero cada
  // fichero ya no es secuencial POR DENTRO — ver MATCH_LOOKUP_CONCURRENCY arriba.
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
 *
 * `sharedNameIndex` es opcional — lo pasa `refreshAllMatchLogFiles` (y el aprobado de
 * una sugerencia de nombre, que también refresca varios ficheros de una sentada) para
 * construir el índice UNA VEZ para todo el lote en vez de una vez por fichero.
 */
export async function refreshMatchLogFile(fileId: number, sharedNameIndex?: NameIndex): Promise<MatchLogFileResult | null> {
  const [file] = await db.select().from(matchLogFiles).where(eq(matchLogFiles.id, fileId));
  if (!file) return null;

  const nameIndex = sharedNameIndex ?? (await buildNameIndex());
  const { totalOnlineEntries, linked, skipped, errors, unresolvedNames } = await processFile(fileId, file.html, nameIndex);

  await db
    .update(matchLogFiles)
    .set({ lastProcessedAt: new Date(), totalOnlineEntries, linked, skipped, errors, unresolvedNames })
    .where(eq(matchLogFiles.id, fileId));

  return { fileId, fileName: file.fileName, totalOnlineEntries, linked, skipped };
}

// Cuántos ficheros se refrescan a la vez en "Refresh all" — igual motivo que
// MATCH_LOOKUP_CONCURRENCY: peticiones HTTP independientes, un tope moderado en vez de
// uno por uno o todos a la vez.
const FILE_REFRESH_CONCURRENCY = 4;

/**
 * "Refresh all" — pedido explícito del propietario: reprocesa TODOS los ficheros ya
 * subidos con el estado de nombres/alias de AHORA, sin tener que pulsar "Refresh"
 * fichero por fichero. Construye el índice de nombres una sola vez para todo el lote
 * (en vez de una vez por fichero, que es lo que hacía repetir esto a mano N veces) y
 * refresca varios ficheros en paralelo.
 */
export async function refreshAllMatchLogFiles(): Promise<MatchLogImportSummary> {
  const [nameIndex, files] = await Promise.all([
    buildNameIndex(),
    db.select({ id: matchLogFiles.id, fileName: matchLogFiles.fileName }).from(matchLogFiles),
  ]);

  const results = await mapWithConcurrency(files, FILE_REFRESH_CONCURRENCY, async (file) => {
    const result = await refreshMatchLogFile(file.id, nameIndex);
    return result ?? { fileId: file.id, fileName: file.fileName, totalOnlineEntries: 0, linked: 0, skipped: 0 };
  });

  return {
    results,
    totalLinked: results.reduce((sum, r) => sum + r.linked, 0),
    totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
  };
}
