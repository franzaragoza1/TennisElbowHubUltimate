"use client";

import Link from "next/link";
import { manaArchiveUrl } from "@/lib/mana/links";

// Año de archivo del foro al que manda la pestaña de más abajo — el propio 2021 (el
// primero que SÍ cubrimos, CLAUDE.md §5) todavía no existía como temporada propia en
// esa página del foro, así que 2020 es el año real más reciente que cae ya fuera de
// nuestro alcance.
const PRE_TE4_ARCHIVE_YEAR = 2020;

/** Pestañas de temporada. Enlaces reales (no estado local) para que cada año sea
 * compartible y navegable con el historial del navegador. */
export function SeasonTabs({
  seasons,
  current,
}: {
  seasons: number[];
  current: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {seasons.map((year) => (
        <Link
          key={year}
          href={`/tournaments?year=${year}`}
          aria-current={year === current ? "page" : undefined}
          className={`text-eyebrow tour-numeric rounded-full px-4 py-2 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
            year === current
              ? "bg-accent-500 text-navy-900"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          }`}
        >
          {year}
        </Link>
      ))}
      {/* Pedido explícito, 2026-09-23: salida directa al propio archivo del foro para
       * las temporadas de antes de 2021 — fuera de alcance del proyecto (CLAUDE.md
       * §5), así que no se importan ni se presentan como una pestaña más de datos
       * propios, solo un enlace de salida real a donde sí viven. */}
      <a
        href={manaArchiveUrl(PRE_TE4_ARCHIVE_YEAR)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-eyebrow tour-numeric rounded-full bg-white/10 px-4 py-2 text-xs text-white/70 transition hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        Pre TE4 Tournaments ↗
      </a>
    </div>
  );
}
