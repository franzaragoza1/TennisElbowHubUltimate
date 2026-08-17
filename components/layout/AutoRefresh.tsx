"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca la página (Server Components incluidos) a intervalos, sin recargar de
 * verdad ni perder la posición de scroll (`router.refresh()`, no `location.reload()`).
 * Pedido explícito: torneos y scores tienen que ponerse al día solos, aunque nadie
 * toque nada — antes solo se refrescaban al navegar o recargar a mano.
 *
 * No hace nada visible (`return null`) — es puro efecto de fondo. Solo corre
 * mientras la pestaña está abierta; no reinventa nada si el usuario ya navegó fuera
 * de la página (el `useEffect` se limpia solo al desmontar).
 */
export function AutoRefresh({ intervalMs = 600_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      // Sin sentido refrescar datos que nadie está mirando — se retoma en el
      // siguiente intervalo una vez la pestaña vuelve a estar visible.
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
