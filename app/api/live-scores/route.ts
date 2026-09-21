import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { liveScoresCache } from "@/db/schema";
import { blendHoldRatesWithElo, computeLiveWinProbability, type LiveTourMatchWithPrediction } from "@/lib/predictor/liveModel";
import { getPlayerServeWinRate } from "@/lib/predictor/serveRate";
import type { LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

const CACHE_ROW_ID = 1;

// Sin `revalidate`: esto ya es una simple lectura de una fila (barata, como casi
// cualquier otra ruta del sitio) — el trabajo real de verdad (parsear live-tennis.cn)
// lo hace scripts/liveScoresSync.ts FUERA de Vercel cada 20s, ver el comentario de
// `live_scores_cache` en db/schema.ts para el motivo (era la ruta que más "Fluid
// Active CPU" gastaba de todo el sitio). El propio sync ya actualiza la fila cada
// 20s, así que cachear esta lectura aparte no ahorraría nada más.
export const dynamic = "force-dynamic";

/** El Win% en vivo se calcula aquí, al leer, no en scripts/liveScoresSync.ts (que solo
 * hace scraping + resolución de identidad, nunca nada analítico) — así el modelo vive
 * en la app principal, con sus tests de `vitest`, y se puede retocar sin tocar el
 * proceso siempre encendido del scraper. */
async function withWinProbability(match: LiveTourMatch): Promise<LiveTourMatchWithPrediction> {
  const [ownHoldA, ownHoldB] = await Promise.all([getPlayerServeWinRate(match.player1.id), getPlayerServeWinRate(match.player2.id)]);
  // Elo de live-tennis.cn (lib/liveTennis/parseLivePage.ts), mezclado en el hold rate
  // antes del cálculo — ver el comentario de blendHoldRatesWithElo. `null`/`null` (sin
  // elo de ninguno de los dos) devuelve ownHoldA/ownHoldB tal cual, mismo resultado que
  // antes de que existiera esto.
  const { holdA, holdB } = blendHoldRatesWithElo(ownHoldA, ownHoldB, match.player1.elo, match.player2.elo, match.format);
  return { ...match, winProbability: computeLiveWinProbability(match, holdA, holdB) };
}

/**
 * Nunca lanza: sin fila todavía (el proceso de sync no ha corrido nunca, p.ej. recién
 * desplegado) responde una lista vacía en vez de tumbar "Live Now" — mismo criterio de
 * fallo silencioso de siempre. Lo mismo si el cálculo de Win% de un partido concreto
 * fallara por lo que sea: ese partido se enseña sin la predicción antes que tumbar la
 * tira entera de partidos en vivo por uno solo.
 */
export async function GET() {
  try {
    const [row] = await db.select({ matches: liveScoresCache.matches }).from(liveScoresCache).where(eq(liveScoresCache.id, CACHE_ROW_ID));
    const matches = (row?.matches ?? []) as LiveTourMatch[];
    const withPredictions = await Promise.all(
      matches.map(async (m) => {
        try {
          return await withWinProbability(m);
        } catch {
          return m;
        }
      }),
    );
    return NextResponse.json({ matches: withPredictions });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
