/** Sin dependencias a propósito (ni siquiera `@/db/client`) — es lo que permite
 * probarlo con Vitest, que no resuelve el alias `@/` (ver lib/topicSlug.ts, que sí
 * necesita `db` para `uniqueSlug` y por eso no se puede importar directamente en un
 * test). */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
