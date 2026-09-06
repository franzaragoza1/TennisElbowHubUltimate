import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { NATIVE_SOURCE_SLUG } from "@/lib/nativeTournaments/source";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

interface OngoingEditionRow {
  edition_id: number;
}

/**
 * TODAS las ediciones nativas en curso a la vez (cuadro publicado, ronda `F` sin
 * decidir — mismo criterio que lib/tournamentStatus.ts::deriveTournamentStatus),
 * sin la restricción de "solo la semana más temprana" de
 * lib/liveRanking/liveWeek.ts::getLiveWeek: esa era una simplificación específica
 * del ranking de Mana (una sola "semana en vivo" tiene sentido porque el ranking
 * oficial de Mana avanza semana a semana); el Live Ranking nativo no tiene ese
 * concepto de semana, así que cualquier edición en curso cuenta.
 */
export async function getOngoingNativeEditionIds(): Promise<number[]> {
  const result = await db.execute(sql`
    SELECT e.id AS edition_id
    FROM editions e
    JOIN sources s ON s.id = e.source_id
    WHERE s.slug = ${NATIVE_SOURCE_SLUG}
      AND (
        EXISTS(SELECT 1 FROM matches m WHERE m.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM byes b WHERE b.edition_id = e.id)
        OR EXISTS(SELECT 1 FROM pending_slots ps WHERE ps.edition_id = e.id)
      )
      AND NOT EXISTS(SELECT 1 FROM matches mf WHERE mf.edition_id = e.id AND mf.round = 'F')
  `);
  return rowsOf<OngoingEditionRow>(result).map((r) => Number(r.edition_id));
}
