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
  // 0: la URL a tamaño (lib/avatarSize.ts) · 1: la URL original tal cual · 2: iniciales.
  // El paso 1 existe porque Discord, para un avatar ya cambiado (hash viejo guardado
  // aquí), solo sigue sirviendo las variantes que tenía en caché: `.gif` sin tamaño
  // responde y `.gif?size=256` da 404 "Invalid resource" (real, 2026-10-11).
  const sized = sizedAvatarUrl(src, size);
  const [stage, setStage] = useState(sized === src ? 1 : 0);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) {
      // Solo se puede saber una vez montada la imagen real en el DOM.
      setStage((s) => s + 1);
    }
  }, []);

  if (stage >= 2) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto remota de Discord o subida propia, no un asset next/image
    <img
      key={stage}
      ref={ref}
      src={stage === 0 ? sized : src}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setStage((s) => s + 1)}
    />
  );
}
