"use client";

import Link from "next/link";

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
    </div>
  );
}
