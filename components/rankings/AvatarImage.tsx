"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * `<img>` de avatar que cae a `fallback` (las iniciales) si la imagen no carga — una URL
 * de avatar de Discord que ya no existe (404) dejaba un círculo negro roto en vez de
 * nada útil (real, 2026-09-26). `onError` no se dispara si la imagen ya falló ANTES de
 * hidratar (viene renderizada del servidor), así que también se comprueba al montar.
 */
export function AvatarImage({ src, className, fallback }: { src: string; className: string; fallback: ReactNode }) {
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
  return <img ref={ref} src={src} alt="" className={className} onError={() => setFailed(true)} />;
}
