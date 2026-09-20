/**
 * Vuelve a alojar en Cloudflare R2 (ver lib/mediaStorage.ts) cualquier URL de imagen
 * EXTERNA que un admin o reportero pegue en una noticia — pedido explícito tras un
 * caso real: una imagen de perfect-tennis.com (detrás de Cloudflare) pasaba `curl`
 * sin problema pero el navegador la bloqueaba con ERR_BLOCKED_BY_ORB (ver
 * docs/decisiones.md), casi seguro por su propia protección anti-bot tratando
 * distinto una petición que huele a automatizada — algo que un `fetch()` normal
 * desde el servidor (sin las cabeceras ni la huella TLS de un navegador de verdad)
 * no debería disparar. Nunca se sabe de antemano qué CDN externo hará lo mismo, así
 * que en vez de arreglarlo caso por caso cuando alguien lo reporte, toda imagen
 * externa se descarga UNA VEZ al guardar la noticia y se sube a nuestro propio
 * almacenamiento. Quien lee la noticia después nunca vuelve a hablar con el CDN
 * externo, así que ORB (o lo que sea que le pase a ese host en concreto) deja de
 * importar.
 *
 * Hasta el 2026-09-20 esto guardaba la imagen como `data:<tipo>;base64,<...>`
 * directamente en `news.image_url` — bug real de ancho de banda: un data URI no
 * tiene URL propia que un navegador pueda cachear, así que `NewsWidget.tsx` (sidebar
 * de casi todo el sitio) lo retransmitía entero en CADA página que lo mostrara, para
 * siempre. Una URL real de R2 se descarga una vez por navegador y se reutiliza.
 *
 * Ya alojada aquí (empieza por `R2_PUBLIC_URL`) o ruta relativa (`/`): se deja tal
 * cual, no hay nada que volver a descargar. Un fallo (host caído, tipo de contenido
 * que no es imagen, demasiado grande, URL que ni siquiera es válida, o el propio R2
 * fallando) NUNCA bloquea guardar la noticia — se cae de vuelta a la URL externa tal
 * cual la escribieron, mismo criterio de "nunca lanza, nunca deja las cosas peor de
 * lo que ya estaban" que el resto del proyecto.
 */
import { uploadImageToMediaStorage } from "./mediaStorage";

const FETCH_TIMEOUT_MS = 8000;
// 600KB en crudo — cifra elegida a mano, de sobra para una foto editorial (nunca se
// enseña a tamaño completo salvo en la propia página del artículo). Ya no hay límite
// de caché de 2MB del que cuidarse (ver historial de este fichero): R2 solo guarda la
// URL en la base de datos, no la imagen en sí.
const MAX_IMAGE_BYTES = 600_000;

export async function rehostImageIfExternal(url: string | null): Promise<string | null> {
  if (!url) return null;
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (url.startsWith("/") || url.startsWith("data:") || (r2PublicUrl && url.startsWith(r2PublicUrl))) return url;

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

    return await uploadImageToMediaStorage(buffer, contentType, "news");
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}
