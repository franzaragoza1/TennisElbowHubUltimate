"use server";

import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { authUsers, matchLogFiles, playerNameSuggestions, players } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { refreshAllMatchLogFiles, refreshMatchLogFile as runRefresh, type MatchLogImportSummary } from "@/lib/matchLog/importMatchLog";
import { buildNameIndex } from "@/lib/matchLog/linkToTourMatch";
import {
  approveNameSuggestion,
  dismissNameSuggestion,
  generateNameSuggestions,
  type SuggestMatchesResult,
} from "@/lib/matchLog/suggestNameMatches";

export interface MatchLogFileRow {
  id: number;
  fileName: string;
  uploadedAt: Date;
  lastProcessedAt: Date;
  totalOnlineEntries: number;
  linked: number;
  skipped: number;
  errors: string[];
  /** `null` = subido desde /admin/match-log (ese flujo no tiene identidad de
   * authUsers, ver el comentario de `uploadedByUserId` en db/schema.ts) — nunca "sin
   * subir por nadie". Pedido explícito: identificar quién subió cada fichero. */
  uploadedByName: string | null;
}

/** Últimos ficheros subidos, más recientemente procesado primero (una subida nueva
 * y un "Refresh" cuentan igual — los dos son "actividad reciente" sobre el
 * fichero). */
export async function getRecentMatchLogFiles(limit: number): Promise<MatchLogFileRow[]> {
  await requireAdmin();
  const rows = await db
    .select({
      id: matchLogFiles.id,
      fileName: matchLogFiles.fileName,
      uploadedAt: matchLogFiles.uploadedAt,
      lastProcessedAt: matchLogFiles.lastProcessedAt,
      totalOnlineEntries: matchLogFiles.totalOnlineEntries,
      linked: matchLogFiles.linked,
      skipped: matchLogFiles.skipped,
      errors: matchLogFiles.errors,
      uploadedByName: authUsers.name,
    })
    .from(matchLogFiles)
    .leftJoin(authUsers, eq(authUsers.id, matchLogFiles.uploadedByUserId))
    .orderBy(desc(matchLogFiles.lastProcessedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, errors: Array.isArray(r.errors) ? (r.errors as string[]) : [] }));
}

/** "Refresh" — vuelve a procesar el HTML ya guardado de este fichero con el estado
 * de nombres/alias de AHORA (ver `lib/matchLog/importMatchLog.ts::refreshMatchLogFile`
 * para por qué esto es útil justo después de añadir un `player_known_names` nuevo). */
export async function refreshMatchLogFile(formData: FormData): Promise<void> {
  await requireAdmin();
  const fileId = Number(formData.get("fileId"));
  if (!Number.isInteger(fileId)) return;

  const result = await runRefresh(fileId);
  if (result && result.linked > 0) revalidatePath("/stats");
  revalidatePath("/account");
}

/**
 * "Eliminate" — pedido explícito: borra el fichero Y las estadísticas reales que
 * escribió (`match_stats.match_log_file_id` en cascada, ver db/schema.ts), no solo
 * la entrada del historial. Ficheros subidos ANTES de que existiera esta columna
 * (los primeros de esta sesión) no tienen filas de `match_stats` atribuidas a
 * ningún fichero, así que borrarlos solo limpia su propio registro.
 */
export async function deleteMatchLogFile(formData: FormData): Promise<void> {
  await requireAdmin();
  const fileId = Number(formData.get("fileId"));
  if (!Number.isInteger(fileId)) return;

  await db.delete(matchLogFiles).where(eq(matchLogFiles.id, fileId));

  revalidatePath("/stats");
  revalidatePath("/account");
}

export interface NameSuggestionRow {
  id: number;
  unresolvedName: string;
  suggestedPlayerId: number;
  suggestedPlayerName: string;
  reason: string | null;
}

/** Sugerencias pendientes de revisar, más antigua primero (así se atienden en el
 * orden en que la IA las fue generando). */
export async function getPendingNameSuggestions(): Promise<NameSuggestionRow[]> {
  await requireAdmin();
  return db
    .select({
      id: playerNameSuggestions.id,
      unresolvedName: playerNameSuggestions.unresolvedName,
      suggestedPlayerId: playerNameSuggestions.suggestedPlayerId,
      suggestedPlayerName: players.displayName,
      reason: playerNameSuggestions.reason,
    })
    .from(playerNameSuggestions)
    .innerJoin(players, eq(players.id, playerNameSuggestions.suggestedPlayerId))
    .where(eq(playerNameSuggestions.status, "pending"))
    .orderBy(asc(playerNameSuggestions.createdAt));
}

/** "Find matches with AI" — botón disparado a mano, sin cron (mismo patrón que
 * `generateNewsDrafts`). `useActionState` en el cliente exige la firma
 * `(prevState, formData)`, aunque aquí no se lea ningún campo del formulario. */
/* eslint-disable @typescript-eslint/no-unused-vars -- firma fija de useActionState, no hace falta leer ninguno de los dos */
export async function scanForNameSuggestions(
  _prevState: SuggestMatchesResult | null,
  _formData: FormData,
): Promise<SuggestMatchesResult> {
  await requireAdmin();
  const result = await generateNameSuggestions();
  if (result.suggested > 0) revalidatePath("/account");
  return result;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Aprobar = exactamente lo mismo que si el admin hubiera escrito el nombre a mano en
 * `/admin/players/[id]` (`addPlayerKnownName`), más un `refresh` automático de
 * cualquier fichero que trajera ese nombre — para que los partidos que dependían de
 * él enlacen sin que el admin tenga que ir fichero por fichero pulsando Refresh.
 *
 * Toma varios ids a la vez (pedido explícito: checkboxes + "approve selected/all" en
 * components/admin/matchlog/SuggestedMatchesList.tsx, un solo id es solo el caso
 * `[id]`) — el índice de nombres se construye UNA vez para el lote entero, nunca uno
 * por sugerencia, mismo motivo que `refreshAllMatchLogFiles`.
 */
export async function approveSuggestions(ids: number[]): Promise<void> {
  await requireAdmin();
  const validIds = ids.filter((id) => Number.isInteger(id));
  if (validIds.length === 0) return;

  const affectedFileIds = new Set<number>();
  for (const id of validIds) {
    const outcome = await approveNameSuggestion(id);
    outcome?.affectedFileIds.forEach((fileId) => affectedFileIds.add(fileId));
  }

  if (affectedFileIds.size > 0) {
    const nameIndex = await buildNameIndex();
    let anyLinked = false;
    for (const fileId of affectedFileIds) {
      const result = await runRefresh(fileId, nameIndex);
      if (result && result.linked > 0) anyLinked = true;
    }
    if (anyLinked) revalidatePath("/stats");
  }

  revalidatePath("/account");
}

/** "Refresh all" — pedido explícito: reprocesa todos los ficheros ya subidos con el
 * estado de nombres/alias de AHORA, sin pulsar "Refresh" fichero por fichero. Usa
 * `useActionState` en el cliente, igual que `scanForNameSuggestions`. */
/* eslint-disable @typescript-eslint/no-unused-vars -- firma fija de useActionState */
export async function refreshAllFiles(
  _prevState: MatchLogImportSummary | null,
  _formData: FormData,
): Promise<MatchLogImportSummary> {
  await requireAdmin();
  const summary = await refreshAllMatchLogFiles();
  if (summary.totalLinked > 0) revalidatePath("/stats");
  revalidatePath("/account");
  return summary;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export async function dismissSuggestions(ids: number[]): Promise<void> {
  await requireAdmin();
  const validIds = ids.filter((id) => Number.isInteger(id));
  if (validIds.length === 0) return;

  for (const id of validIds) {
    await dismissNameSuggestion(id);
  }
  revalidatePath("/account");
}
