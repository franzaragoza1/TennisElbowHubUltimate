import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { liveScoresCache } from "@/db/schema";

const CACHE_ROW_ID = 1;

// Sin `revalidate`: esto ya es una simple lectura de una fila (barata, como casi
// cualquier otra ruta del sitio) — el trabajo real de verdad (parsear live-tennis.cn)
// lo hace scripts/liveScoresSync.ts FUERA de Vercel cada 20s, ver el comentario de
// `live_scores_cache` en db/schema.ts para el motivo (era la ruta que más "Fluid
// Active CPU" gastaba de todo el sitio). El propio sync ya actualiza la fila cada
// 20s, así que cachear esta lectura aparte no ahorraría nada más.
export const dynamic = "force-dynamic";

/**
 * Nunca lanza: sin fila todavía (el proceso de sync no ha corrido nunca, p.ej. recién
 * desplegado) responde una lista vacía en vez de tumbar "Live Now" — mismo criterio de
 * fallo silencioso de siempre.
 */
export async function GET() {
  try {
    const [row] = await db.select({ matches: liveScoresCache.matches }).from(liveScoresCache).where(eq(liveScoresCache.id, CACHE_ROW_ID));
    return NextResponse.json({ matches: row?.matches ?? [] });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
