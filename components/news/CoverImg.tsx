"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * `<img>` de portada que desaparece si la imagen no carga, dejando la tarjeta como si
 * la noticia no tuviera imagen (2026-10-11). Caso real: portadas guardadas con la URL
 * de un adjunto de Discord, que caduca — el navegador pintaba el icono de imagen rota.
 * Las nuevas ya no pasan (lib/newsImage.ts las reduce y las sube a R2); esto cubre las
 * que ya estaban guardadas.
 *
 * El `useEffect` cubre el caso de que la imagen falle ANTES de que React enganche el
 * `onError` (HTML del servidor, imagen ya rota en caché): `complete` sin
 * `naturalWidth` es un fallo ya ocurrido.
 */
export function CoverImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- mismo <img> que antes; `alt` llega en props
  return <img ref={ref} {...props} onError={() => setFailed(true)} />;
}
