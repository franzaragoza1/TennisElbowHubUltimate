import { getImageProps } from "next/image";

/**
 * La URL de una imagen editorial remota (portadas de noticias) al ancho al que se pinta
 * (pase de rendimiento, 2026-10-11, ver docs/decisiones.md): las portadas se servían
 * enteras (70-130 KB) para miniaturas de 56x40 px en el sidebar de casi todas las
 * páginas. Para los orígenes que conocemos y aceptamos en `images.remotePatterns`
 * (next.config.ts: el bucket R2 propio, Imgur) se pasa por el optimizador de Next
 * (WebP, al ancho pedido x2 para retina); cualquier otra URL (p.ej. un adjunto de
 * Discord pegado a mano) se devuelve sin tocar — el optimizador rechazaría un origen no
 * declarado.
 */
const OPTIMIZABLE = [/^https:\/\/[a-z0-9-]+\.r2\.dev\//i, /^https:\/\/i\.imgur\.com\//i];

export function remoteImageSrc(url: string, cssWidth: number): string {
  if (!OPTIMIZABLE.some((rx) => rx.test(url))) return url;
  return getImageProps({ src: url, alt: "", width: Math.round(cssWidth * 2), height: Math.round(cssWidth * 2 * 0.5625) }).props.src;
}
