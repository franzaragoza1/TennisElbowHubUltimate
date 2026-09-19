/**
 * Caché en memoria del propio proceso, con TTL — reemplazo deliberado de
 * `unstable_cache` de Next.js para funciones que SÍ dependen de sus argumentos
 * (un `playerId`, un par de jugadores...). Bug real y confirmado en esta versión de
 * Next.js (ver el comentario de `getRankingsPageData` en app/rankings/page.tsx):
 * `unstable_cache` puede quedarse sirviendo indefinidamente el resultado de OTRA
 * combinación de argumentos — sospecha razonable ligada al número de argumentos,
 * root cause nunca confirmada del todo. Para páginas ya dinámicas sin caché real
 * (rankings, players, tournaments, stats) la solución fue quitar la caché sin más
 * (coste cero, ya eran SSR dinámico). Aquí no: este módulo lo usan widgets que salen
 * en el sidebar de casi todas las páginas del sitio, donde SÍ hay un coste de
 * rendimiento real y ya medido detrás de cachear (ver H2HWidget.tsx/
 * ProfileWidget.tsx) — sustituir `unstable_cache` por un `Map` propio evita el bug
 * (nunca pasa por su mecanismo interno) sin renunciar al ahorro.
 *
 * Mismo hueco de uso que `unstable_cache(fn, keyParts, {revalidate})` a propósito
 * (sin `keyParts`: la clave sale sola de los argumentos reales) — cambiar de uno a
 * otro en una llamada existente es una línea. Sin límite de tamaño por entrada (a
 * diferencia de `unstable_cache`, que serializa a JSON con un tope de 2MB — ver el
 * comentario de `getPlayerPageData` en app/players/[id]/page.tsx) y sin persistencia
 * entre reinicios (aceptable: Render corre un único servicio web, no hace falta
 * coherencia entre instancias). Sin límite de entradas tampoco — a la escala de este
 * sitio (unos cientos de jugadores) nunca crece lo bastante para que importe.
 */
export function memoizeWithTtl<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>, ttlMs: number): (...args: Args) => Promise<R> {
  const cache = new Map<string, { value: R; expiresAt: number }>();

  return async (...args: Args): Promise<R> => {
    const key = JSON.stringify(args);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await fn(...args);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}
