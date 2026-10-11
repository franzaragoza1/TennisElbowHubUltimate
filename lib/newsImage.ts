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
// Lo que se acepta DESCARGAR (2026-10-11): una imagen más grande que MAX_IMAGE_BYTES ya
// no se rinde, se reduce (ver `shrinkImage`). Caso real: las capturas pegadas desde
// Discord pesan varios MB, el límite hacía caer a la URL de Discord tal cual, y esas
// URLs caducan a las ~24 h — la portada quedaba rota para siempre.
const MAX_DOWNLOAD_BYTES = 15_000_000;
// Ancho de sobra para la cabecera del artículo (la pieza más ancha que la pinta).
const SHRINK_MAX_WIDTH = 1600;

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
    if (contentLength > MAX_DOWNLOAD_BYTES) return url;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) return url;
    if (buffer.byteLength <= MAX_IMAGE_BYTES) return await uploadImageToMediaStorage(buffer, contentType, "news");

    const small = await shrinkImage(buffer);
    if (!small || small.byteLength > MAX_IMAGE_BYTES) return url;
    return await uploadImageToMediaStorage(small, "image/webp", "news");
  } catch {
    return url;
  } finally {
    clearTimeout(timer);
  }
}

/** WebP de como mucho SHRINK_MAX_WIDTH de ancho (sin agrandar; los GIF animados siguen
 * animados), probando pasos más pequeños hasta quedar en MAX_IMAGE_BYTES. `null` si
 * no es una imagen que sharp sepa leer o ni el paso más pequeño cabe. */
async function shrinkImage(buffer: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    for (const [width, quality] of SHRINK_STEPS) {
      const out = await sharp(buffer, { animated: true })
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (out.byteLength <= MAX_IMAGE_BYTES) return out;
    }
    return null;
  } catch {
    return null;
  }
}

const SHRINK_STEPS: [number, number][] = [
  [SHRINK_MAX_WIDTH, 80],
  [1280, 72],
  [960, 65],
];
