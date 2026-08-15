"use client";

import { useEffect, useState } from "react";

/**
 * `true` en cuanto se confirma que `src` carga, `false` en otro caso (incluida la
 * espera inicial). No usar `<img onError>` para esto: el `<img>` renderizado en el
 * servidor empieza a cargar en cuanto el navegador parsea el HTML, ANTES de que React
 * hidrate y enganche el manejador — un 404 rápido (como estos logos, que todavía no
 * existen) puede fallar y perderse el evento antes de que `onError` esté enganchado.
 * Precargar con un `Image` de JS desde un `useEffect` no tiene ese hueco: nunca se
 * pinta nada hasta que el propio JavaScript confirma que existe.
 */
export function useImageExists(src: string): boolean {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setExists(true);
    };
    img.onerror = () => {
      if (!cancelled) setExists(false);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return exists;
}
