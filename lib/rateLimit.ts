/**
 * Ventana deslizante genérica contra abuso — un `bucketKey` compartido (login de admin,
 * subida de MatchLog de un usuario, solicitud de claim de un usuario...) acumula filas en
 * `rate_limit_hits` (ver db/schema.ts) y se cuenta cuántas caen dentro de la ventana. No
 * hay contador acumulado que resetear: contar filas recientes ES la ventana deslizante.
 *
 * Se autolimpia sola en cada llamada (borra lo de ese mismo `bucketKey` con más de 24h) —
 * nunca crece sin límite, no hace falta un cron aparte para una tabla que en un sitio de
 * este tamaño nunca pasa de un puñado de filas.
 */
import { and, count, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitHits } from "@/db/schema";

const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

async function cleanupBucket(bucketKey: string): Promise<void> {
  await db
    .delete(rateLimitHits)
    .where(and(eq(rateLimitHits.bucketKey, bucketKey), lt(rateLimitHits.createdAt, new Date(Date.now() - CLEANUP_AGE_MS))));
}

/** Solo mira — no cuenta como un intento más. Para flujos donde no todo intento debe
 * consumir hueco (login de admin: un acierto no debe gastar el cupo de fallos). */
export async function peekRateLimited(bucketKey: string, windowMs: number, maxHits: number): Promise<boolean> {
  await cleanupBucket(bucketKey);
  const windowStart = new Date(Date.now() - windowMs);
  const [{ value }] = await db
    .select({ value: count() })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.bucketKey, bucketKey), gt(rateLimitHits.createdAt, windowStart)));
  return value >= maxHits;
}

/** Registra un intento contra el cupo, sin comprobar nada — usarlo tras `peekRateLimited`
 * cuando el propio intento (no el resultado) es lo que debe contar. */
export async function recordHit(bucketKey: string): Promise<void> {
  await db.insert(rateLimitHits).values({ bucketKey });
}

/**
 * `true` = límite alcanzado, la llamada debe rechazarse (no se registra un intento más).
 * `false` = todavía hay hueco — se registra este intento y se permite seguir. Para el
 * caso normal ("cada llamada permitida cuenta"): subidas de MatchLog, solicitudes de
 * claim. El login de admin usa `peekRateLimited`/`recordHit` por separado (ver
 * app/admin/actions.ts) porque ahí solo los fallos deben gastar cupo.
 */
export async function isRateLimited(bucketKey: string, windowMs: number, maxHits: number): Promise<boolean> {
  if (await peekRateLimited(bucketKey, windowMs, maxHits)) return true;
  await recordHit(bucketKey);
  return false;
}
