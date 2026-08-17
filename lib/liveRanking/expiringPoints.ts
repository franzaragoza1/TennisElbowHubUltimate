import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { editions, rankingSnapshots, sources } from "@/db/schema";
import { getSecuredPointsByPlayer } from "./securedPoints";

const MAX_WEEK_SEARCH = 53; // un año ISO nunca tiene más de 53 semanas

export interface IsoWeekRef {
  isoYear: number;
  isoWeek: number;
}

/**
 * Semana del año anterior que "expira" esta semana — por número de semana, no por
 * cálculo exacto de 52 semanas (pedido explícito). Si esa semana exacta no tiene
 * ranking oficial importado, busca hacia semanas MÁS ALTAS del mismo año anterior
 * (pedido explícito: "closest week number, bigger") hasta encontrar una que sí lo
 * tenga. Si el año anterior no existe en absoluto en lo importado (p. ej. calculando
 * sobre 2022 contra 2021, el primer año del archivo), no expira nada.
 */
export async function findMatchingPriorYearWeek(isoYear: number, isoWeek: number): Promise<IsoWeekRef | null> {
  const priorYear = isoYear - 1;

  const existingWeeks = await db
    .selectDistinct({ isoWeek: rankingSnapshots.isoWeek })
    .from(rankingSnapshots)
    .where(and(eq(rankingSnapshots.kind, "official"), eq(rankingSnapshots.isoYear, priorYear)));
  if (existingWeeks.length === 0) return null;

  const available = new Set(existingWeeks.map((w) => w.isoWeek));
  for (let w = isoWeek; w <= MAX_WEEK_SEARCH; w++) {
    if (available.has(w)) return { isoYear: priorYear, isoWeek: w };
  }
  return null;
}

/** Puntos que cada jugador ganó en una semana ya decidida — misma fórmula que
 * `getSecuredPointsByPlayer`, aplicada a una semana pasada en vez de la que está en
 * curso ahora mismo (esa semana ya está completa, así que "asegurado" y "definitivo"
 * coinciden sin nada especial que tratar). */
export async function getExpiringPointsByPlayer(isoYear: number, isoWeek: number): Promise<Map<number, number>> {
  const [manaSource] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, "mana"));
  if (!manaSource) return new Map();

  const weekEditions = await db
    .select({ id: editions.id })
    .from(editions)
    .where(and(eq(editions.sourceId, manaSource.id), eq(editions.year, isoYear), eq(editions.isoWeek, isoWeek)));
  const editionIds = weekEditions.map((e) => e.id);
  if (editionIds.length === 0) return new Map();

  const secured = await getSecuredPointsByPlayer(editionIds);
  return new Map([...secured.entries()].map(([playerId, entry]) => [playerId, entry.points]));
}
