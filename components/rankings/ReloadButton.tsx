"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** "Botón de recarga" de la barra de filtros del ranking (CLAUDE.md §6) — fuerza un
 * refresco del Server Component actual (`router.refresh()`), útil cuando se sospecha
 * que la vista se quedó con datos de hace un rato (sobre todo con "Directo" activo).
 * `useTransition`, no un `useState` a mano, para que el icono gire exactamente
 * mientras Next está de verdad esperando la respuesta del servidor, ni un instante
 * más ni menos. */
export function ReloadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-label="Reload rankings"
      title="Reload"
      className="tap-scale flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black text-white shadow-sm transition-colors hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className={isPending ? "animate-spin" : ""}
      >
        <path d="M16 10a6 6 0 1 1-1.76-4.24" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 3v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
