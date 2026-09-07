"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { requireAdmin } from "@/lib/adminSession";
import { loadTournamentByExternalId, parseTrnInput, type LoadTournamentResult } from "@/lib/mana/loadTournament";
import { needsQueueing, queueScrapeRequest } from "@/lib/scrapeQueue";
import type { TournamentStatus } from "@/lib/tournamentStatus";

export interface AddTournamentOutcome {
  result: LoadTournamentResult | null;
  error: string | null;
  /** true si esto no se ejecutó ahora mismo — se dejó encolado para que el servidor
   * casero lo recoja (ver lib/scrapeQueue.ts), porque esto está corriendo en Vercel. */
  queued?: boolean;
  /** true si ya había una petición igual esperando/en marcha — no se duplicó. */
  alreadyQueued?: boolean;
}

/** Va a buscar `OT_ViewTournament.php?Trn=<input>` en vivo (número suelto o URL pegada
 * tal cual) y la carga/actualiza en la base de datos — sirve igual para un torneo que
 * todavía no existe aquí como para uno ya importado que ha avanzado desde la última
 * vez. En Vercel (`needsQueueing()`) no hay Chromium real disponible (ver
 * `lib/mana/fetchLive.ts`), así que se encola para que `scripts/autoScrape.ts` lo
 * ejecute de verdad en su siguiente pasada — corriendo en local o en el servidor
 * casero, el comportamiento no cambia. */
export async function addOrRefreshTournament(input: string): Promise<AddTournamentOutcome> {
  await requireAdmin();

  const externalId = parseTrnInput(input);
  if (!externalId) {
    return { result: null, error: 'No se reconoce como Trn= — pega el número (p. ej. "2095") o la URL completa del cuadro.' };
  }

  if (needsQueueing()) {
    const { alreadyQueued } = await queueScrapeRequest("tournament", externalId);
    revalidatePath("/account");
    return { result: null, error: null, queued: true, alreadyQueued };
  }

  try {
    const result = await loadTournamentByExternalId(externalId);
    revalidatePath("/account");
    revalidatePath("/tournaments");
    revalidatePath(`/tournaments/${result.editionId}`);
    revalidatePath("/");
    return { result, error: null };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface RecentEditionRow {
  editionId: number;
  externalId: string;
  eventName: string;
  year: number;
  isoWeek: number | null;
  status: TournamentStatus;
}

interface RecentEditionRawRow {
  edition_id: number;
  external_id: string;
  event_name: string;
  year: number;
  iso_week: number | null;
  has_draw: boolean;
  has_final: boolean;
}

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

/** Últimas ediciones tocadas (mayor id primero, no por fecha de partido — sirve para
 * confirmar de un vistazo que la última carga puntual entró bien, y para ver de un
 * vistazo qué sigue en inscripción o en juego). */
export async function getRecentlyLoadedTournaments(limit: number): Promise<RecentEditionRow[]> {
  await requireAdmin();
  const result = await db.execute(sql`
    SELECT
      e.id            AS edition_id,
      e.external_id,
      ev.display_name AS event_name,
      e.year,
      e.iso_week,
      (
        EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes b WHERE b.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)
      ) AS has_draw,
      EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id AND m.round = 'F') AS has_final
    FROM editions e
    JOIN events ev ON ev.id = e.event_id
    ORDER BY e.id DESC
    LIMIT ${limit}
  `);

  return rowsOf<RecentEditionRawRow>(result).map((r) => ({
    editionId: Number(r.edition_id),
    externalId: r.external_id,
    eventName: r.event_name,
    year: Number(r.year),
    isoWeek: r.iso_week === null ? null : Number(r.iso_week),
    status: !r.has_draw ? "registration" : r.has_final ? "completed" : "ongoing",
  }));
}
