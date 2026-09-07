/**
 * Ventanas de "My Stats" (/account) — módulo APARTE de lib/statsQueries.ts a
 * propósito: ese módulo importa db/client.ts (lee `DATABASE_URL` al cargar, revienta
 * si falta), y components/account/MyStatsCard.tsx es "use client" y necesita
 * MY_STATS_WINDOWS como valor real en el navegador para pintar los botones de
 * periodo — cualquier import de valor desde statsQueries.ts arrastraría ese módulo
 * entero (con su `db/client.ts`) al bundle del cliente, reventando en el navegador con
 * "Falta DATABASE_URL en el entorno" (bug real, ver Runtime Error en /account al
 * entrar en Overview). Este fichero no toca la base de datos, así que es seguro de
 * importar desde cualquiera de los dos lados.
 *
 * "career" (sin filtro de fecha) es la única ventana no-numérica, así que se
 * distingue por tipo en vez de con un número mágico (0 o -1) que colisionara con un
 * número de días real.
 */
export const MY_STATS_WINDOWS = [30, 90, 180, 365, "career"] as const;
export type MyStatsWindow = (typeof MY_STATS_WINDOWS)[number];
export const DEFAULT_MY_STATS_WINDOW: MyStatsWindow = 90;

function isMyStatsWindow(v: unknown): v is MyStatsWindow {
  return (MY_STATS_WINDOWS as readonly unknown[]).includes(v);
}

export function parseMyStatsWindow(raw: unknown): MyStatsWindow {
  if (typeof raw === "string" && raw !== "career") {
    const n = Number(raw);
    if (isMyStatsWindow(n)) return n;
  }
  return isMyStatsWindow(raw) ? raw : DEFAULT_MY_STATS_WINDOW;
}
