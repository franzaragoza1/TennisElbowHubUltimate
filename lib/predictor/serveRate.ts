import { eq, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db/client";
import { matchStats } from "@/db/schema";
import { memoizeWithTtl } from "@/lib/memoCache";

/** Cuota mínima de puntos de saque registrados antes de fiarse del propio dato de un
 * jugador — por debajo de esto (un par de partidos con estadísticas sueltas) el ruido
 * de muestra pequeña pesa más que la señal, y se cae a la media del tour. */
const MIN_SERVE_POINTS_FOR_OWN_RATE = 60;

/** `/api/live-scores` llama a esto en CADA sondeo (cada 60s, desde cada pestaña
 * abierta, por cada partido en vivo) — sin cachear, eso es una consulta nueva de
 * verdad por sondeo indefinidamente mientras dure el partido, para un dato (el % de
 * saque histórico de un jugador) que no cambia de un minuto a otro. Bug real,
 * corregido 2026-09-17. */
const SERVE_RATE_REVALIDATE_SECONDS = 600;

async function serveWinRate(playerFilter: SQL | undefined): Promise<{ rate: number | null; points: number }> {
  const [row] = await db
    .select({
      won: sql<number>`coalesce(sum(coalesce(${matchStats.firstServePointsWon}, 0) + coalesce(${matchStats.secondServePointsWon}, 0)), 0)::int`,
      played: sql<number>`coalesce(sum(coalesce(${matchStats.firstServePointsPlayed}, 0) + coalesce(${matchStats.secondServePointsPlayed}, 0)), 0)::int`,
    })
    .from(matchStats)
    .where(playerFilter);

  const played = row?.played ?? 0;
  if (played === 0) return { rate: null, points: 0 };
  return { rate: row.won / played, points: played };
}

/** Media del tour entera — usada como respaldo para cualquier jugador sin (suficiente)
 * dato propio. */
export const getTourAverageServeWinRate = unstable_cache(
  async (): Promise<number> => {
    const { rate } = await serveWinRate(undefined);
    // Solo si la tabla entera estuviera vacía (imposible en la práctica, pero el tipo
    // de retorno no admite null) — cifra realista de saque de un tenista amateur/online
    // medio, nunca inventada como si fuera un dato del jugador.
    return rate ?? 0.6;
  },
  ["predictor-tour-avg-serve-rate"],
  { revalidate: SERVE_RATE_REVALIDATE_SECONDS },
);

/**
 * Probabilidad de que este jugador gane un punto sacando, a partir de su propio
 * historial de `match_stats`. Cae a la media del tour si no tiene (suficiente) dato
 * propio — nunca un número inventado por jugador.
 *
 * `memoizeWithTtl`, no `unstable_cache` — esta función recibe un argumento
 * (`playerId`), la misma forma que ya se demostró que puede dejar a `unstable_cache`
 * sirviendo indefinidamente el resultado de OTRO jugador en esta versión de Next.js
 * (ver lib/memoCache.ts). Al sondearse desde `/api/live-scores` cada 60s por cada
 * partido en vivo, quitar la caché sin más reintroduciría justo el bug de 2026-09-17
 * que documenta el comentario de arriba — de ahí el reemplazo en vez de la
 * eliminación lisa y llana que sí bastó en páginas ya dinámicas como /rankings.
 */
export const getPlayerServeWinRate = memoizeWithTtl(async (playerId: number): Promise<number> => {
  const { rate, points } = await serveWinRate(eq(matchStats.playerId, playerId));
  if (rate !== null && points >= MIN_SERVE_POINTS_FOR_OWN_RATE) return rate;
  return getTourAverageServeWinRate();
}, SERVE_RATE_REVALIDATE_SECONDS * 1000);
