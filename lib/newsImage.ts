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
// ~4MB en crudo (antes de base64) — de sobra para una foto editorial, tope contra que
// alguien pegue por error el enlace a un vídeo o un archivo enorme.
const MAX_IMAGE_BYTES = 4_000_000;

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
