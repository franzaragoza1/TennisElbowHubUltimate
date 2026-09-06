import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en el entorno (ver .env.example)");
}

const sql = neon(databaseUrl);

/**
 * Neon (plan gratis/de desarrollo) "suspende" el cómputo tras un rato inactivo — la
 * primera consulta después de eso puede fallar mientras se despierta (unos segundos),
 * aunque la query en sí sea perfecta y `neon-http` no tenga conexión con estado que se
 * pueda corromper (es HTTP puro, cada consulta es una petición nueva). `drizzle-orm/
 * neon-http` llama a `client.query` directamente (ver su `session.js`:
 * `client.query ?? client`), así que basta con envolver ESE método antes de pasarle
 * `sql` a `drizzle()`. Un solo reintento, con una pequeña espera: una query realmente
 * mal formada vuelve a fallar igual en el reintento (nunca esconde un error real de
 * SQL), solo absorbe el golpe de un cómputo dormido.
 */
const originalQuery = sql.query.bind(sql);
sql.query = (async (...args: Parameters<typeof originalQuery>) => {
  try {
    return await originalQuery(...args);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return originalQuery(...args);
  }
}) as typeof sql.query;

export const db = drizzle(sql, { schema });
