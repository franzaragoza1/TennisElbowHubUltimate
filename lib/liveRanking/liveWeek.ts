import { sql } from "drizzle-orm";
import { db } from "@/db/client";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

export interface LiveWeek {
  isoYear: number;
  isoWeek: number;
  editionIds: number[];
}

interface OngoingEditionRow {
  edition_id: number;
  year: number;
  iso_week: number;
}

/**
 * La semana "en vivo": la más temprana entre las ediciones todavía en juego (cuadro
 * publicado, ronda `F` sin decidir — mismo criterio que
 * lib/tournamentStatus.ts::deriveTournamentStatus). Si dos semanas distintas tienen
 * torneos en curso a la vez, solo cuenta la más temprana (pedido explícito: la más
 * nueva ni siquiera tiene semana de ranking oficial todavía). Puede haber más de una
 * edición en la MISMA semana (varios niveles de torneo en paralelo,
 * docs/estructura.md) — todas entran.
 *
 * Restringido a `source = 'mana'` e `iso_week IS NOT NULL`: las ediciones espejadas de
 * Finals (lib/finals/mirror.ts) no tienen semana ISO real y quedan fuera sin necesidad
 * de excluirlas a mano — las Finals no son parte de la cadencia semanal del tour.
 */
export async function getLiveWeek(): Promise<LiveWeek | null> {
  const result = await db.execute(sql`
    SELECT e.id AS edition_id, e.year, e.iso_week
    FROM editions e
    JOIN sources s ON s.id = e.source_id
    WHERE s.slug = 'mana' AND e.iso_week IS NOT NULL
      AND (
        EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes b WHERE b.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)
      )
      AND NOT EXISTS(SELECT 1 FROM matches mf WHERE mf.edition_id = e.id AND mf.round = 'F')
    ORDER BY e.year ASC, e.iso_week ASC
  `);

  const rows = rowsOf<OngoingEditionRow>(result);
  if (rows.length === 0) return null;

  const earliest = rows[0];
  const editionIds = rows
    .filter((r) => r.year === earliest.year && r.iso_week === earliest.iso_week)
    .map((r) => Number(r.edition_id));

  return { isoYear: Number(earliest.year), isoWeek: Number(earliest.iso_week), editionIds };
}
