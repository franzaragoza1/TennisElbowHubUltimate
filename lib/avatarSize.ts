/**
 * La URL de un avatar al tamaño al que se pinta (pase de rendimiento, 2026-10-11, ver
 * docs/decisiones.md). Sin `?size=`, el CDN de Discord sirve el avatar tal cual se
 * subió: en /rankings eran 49 avatares y 1,5 MB para círculos de 44 px. Discord acepta
 * potencias de dos de 16 a 4096; se pide la primera que cubre el doble del tamaño en
 * CSS (pantallas retina).
 *
 * Siempre en WebP (Discord lo sirve para cualquier avatar): un avatar-foto de 128 px en
 * PNG pesaba ~38 KB, en WebP una quinta parte.
 *
 * Avatares animados (hash `a_…`, `.gif`) en tamaños pequeños: se pide `.webp` sin
 * `animated=true`, que Discord sirve como el primer fotograma fijo — en una fila de
 * tabla la animación no aporta nada y un GIF animado pesa varias veces más. A partir de
 * 96 px CSS (cabecera de ficha de jugador) se respeta el GIF.
 *
 * Cualquier otra URL (fotos propias en R2, avatares por defecto `embed/avatars`) se
 * devuelve sin tocar.
 */
const DISCORD_AVATAR = /^https:\/\/cdn\.discordapp\.com\/(avatars|guilds\/\d+\/users\/\d+\/avatars)\/\d+\/[^/?#]+\.(png|jpg|jpeg|webp|gif)(\?[^#]*)?$/;

export function sizedAvatarUrl(url: string, cssPixels: number): string {
  if (!DISCORD_AVATAR.test(url)) return url;
  const want = Math.max(16, Math.ceil(cssPixels * 2));
  let size = 16;
  while (size < want && size < 4096) size *= 2;
  const [path] = url.split("?");
  const file = path.slice(path.lastIndexOf("/") + 1);
  const animated = file.startsWith("a_");
  const keepGif = animated && cssPixels >= 96;
  const out = keepGif ? path : path.replace(/\.(png|jpg|jpeg|gif)$/, ".webp");
  return `${out}?size=${size}`;
}
