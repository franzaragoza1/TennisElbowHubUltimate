import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en el entorno (ver .env.example)");
}

/**
 * Postgres propio en el servidor de Oracle Cloud (2026-10-17, ver docs/decisiones.md):
 * el proyecto de Neon (plan gratis) se quedaba sin horas de cómputo cada mes — el
 * live-scores-sync escribe cada 20 s, así que el cómputo nunca llegaba a dormirse — y
 * al pasar el límite TODAS las consultas fallaban (HTTP 402). Ahora la base de datos,
 * la web, el scraper, el bot y el live-scores-sync viven en la misma máquina: conexión
 * TCP normal con `pg` (pool de conexiones) en vez del driver HTTP de Neon.
 *
 * Sigue sirviendo para una base de datos de desarrollo en Neon (Neon acepta conexiones
 * Postgres normales; su URL ya lleva `sslmode=require`).
 *
 * Una sola pool por proceso: en `next dev` el módulo se recarga con cada cambio y sin
 * `globalThis` cada recarga abriría una pool nueva sin cerrar la anterior.
 */
const globalForDb = globalThis as unknown as { xktPool?: Pool };

const pool =
  globalForDb.xktPool ??
  new Pool({
    connectionString: databaseUrl,
    // web + scraper + bot + live-scores-sync comparten el mismo Postgres (max_connections
    // 200 en docker-compose.yml): 10 por proceso. Durante `next build` solo 2: cada worker
    // de generación estática abre su propia pool y, con el sitio sirviendo a la vez, se
    // llegó a "too many clients already" (2026-10-17, build local contra el servidor).
    max: process.env.NEXT_PHASE === "phase-production-build" ? 2 : 10,
    idleTimeoutMillis: 30_000,
  });
globalForDb.xktPool = pool;

// Un error de una conexión ociosa (p.ej. Postgres reiniciado) no debe tumbar el proceso:
// la pool la descarta y abre otra en la siguiente consulta.
pool.on("error", (err) => {
  console.error("[db] idle connection error:", err.message);
});

export const db = drizzle(pool, { schema });
