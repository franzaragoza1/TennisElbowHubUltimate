"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { sizedAvatarUrl } from "@/lib/avatarSize";

/**
 * `<img>` de avatar que cae a `fallback` (las iniciales) si la imagen no carga — una URL
 * de avatar de Discord que ya no existe (404) dejaba un círculo negro roto en vez de
 * nada útil (real, 2026-09-26). `onError` no se dispara si la imagen ya falló ANTES de
 * hidratar (viene renderizada del servidor), así que también se comprueba al montar.
 */
/** `size`: el tamaño al que se pinta, en px CSS — el avatar de Discord se pide a ese tamaño
 * (lib/avatarSize.ts); `loading="lazy"`: las filas de más abajo no compiten con lo que se ve
 * primero (pase de rendimiento, 2026-10-11). */
export function AvatarImage({ src, className, fallback, size = 64 }: { src: string; className: string; fallback: ReactNode; size?: number }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) {
      // Solo se puede saber una vez montada la imagen real en el DOM.
      setFailed(true);
    }
  }, []);

  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- foto remota de Discord o subida propia, no un asset next/image
  return <img ref={ref} src={sizedAvatarUrl(src, size)} alt="" loading="lazy" decoding="async" className={className} onError={() => setFailed(true)} />;
}
