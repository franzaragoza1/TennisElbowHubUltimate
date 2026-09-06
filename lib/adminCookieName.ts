/**
 * Vive en su propio fichero, separado de lib/adminSession.ts, a propósito: ese módulo
 * importa `node:crypto` y `next/headers` (APIs de Node, no del runtime Edge), pero
 * `proxy.ts` corre en Edge y necesita este mismo nombre de cookie para su comprobación
 * de "cookie ausente" (ver proxy.ts) — importar el módulo entero rompería el bundle de
 * Edge. Este fichero no importa nada, así que es seguro desde cualquiera de los dos.
 */
export const ADMIN_COOKIE_NAME = "te4_admin";
