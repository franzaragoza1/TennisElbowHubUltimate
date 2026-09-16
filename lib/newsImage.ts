/**
 * Vuelve a alojar en la propia base de datos cualquier URL de imagen EXTERNA que un
 * admin o reportero pegue en una noticia — pedido explícito tras un caso real: una
 * imagen de perfect-tennis.com (detrás de Cloudflare) pasaba `curl` sin problema pero
 * el navegador la bloqueaba con ERR_BLOCKED_BY_ORB (ver docs/decisiones.md), casi
 * seguro por su propia protección anti-bot tratando distinto una petición que huele a
 * automatizada — algo que un `fetch()` normal desde el servidor (sin las cabeceras ni
 * la huella TLS de un navegador de verdad) no debería disparar. Nunca se sabe de
 * antemano qué CDN externo hará lo mismo, así que en vez de arreglarlo caso por caso
 * cuando alguien lo reporte, toda imagen externa se descarga UNA VEZ al guardar la
 * noticia y se guarda como data URI — mismo patrón ya usado para los avatares subidos
 * a mano (`players.avatarUrl`, ver app/account/actions.ts::uploadAvatar), sin
 * necesitar ningún servicio de almacenamiento nuevo. Quien lee la noticia después
 * nunca vuelve a hablar con el CDN externo, así que ORB (o lo que sea que le pase a
 * ese host en concreto) deja de importar.
 *
 * Ya alojada aquí (ruta relativa que empieza por "/") o ya un data URI: se deja tal
 * cual, no hay nada que volver a descargar. Un fallo (host caído, tipo de contenido
 * que no es imagen, demasiado grande, URL que ni siquiera es válida) NUNCA bloquea
 * guardar la noticia — se cae de vuelta a la URL externa tal cual la escribieron,
 * mismo criterio de "nunca lanza, nunca deja las cosas peor de lo que ya estaban" que
 * el resto del proyecto.
 */
const FETCH_TIMEOUT_MS = 8000;
// 600KB en crudo (antes de base64, que infla ~33% más) — bug real encontrado
// (2026-09-16): con el tope anterior (4MB) cabía de sobra una foto editorial pesada
// sin avisar de nada, pero ese mismo data URI viaja tal cual dentro de
// `news.image_url` a TODO lo que junta varias noticias en un solo objeto —
// `NewsWidget.tsx` (sidebar de casi todo el sitio) y la propia ficha pública de cada
// jugador etiquetado (`app/players/[id]/page.tsx`) cachean ese objeto entero con
// `unstable_cache`, que tiene su PROPIO límite de 2MB por entrada — nada que ver con
// este tope. Una sola noticia con una imagen de ~2MB base64 bastaba para que esa
// caché fallara en silencio (solo un log de servidor) para cualquiera que la
// mostrara, anulando la propia optimización que existe para evitar repetir consultas
// caras. 600KB en crudo sigue siendo de sobra para una foto de noticia (nunca se
// enseña a tamaño completo salvo en la propia página del artículo), con margen real
// para que varias quepan juntas bajo el límite de 2MB de cualquiera de esas cachés.
const MAX_IMAGE_BYTES = 600_000;

export async function rehostImageIfExternal(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("/") || url.startsWith("data:")) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return url;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return url;

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > MAX_IMAGE_BYTES) return url;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return url;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}
