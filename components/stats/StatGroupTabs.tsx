import Link from "next/link";
import { STAT_GROUPS, type StatGroup } from "@/lib/statGroups";

export type { StatGroup };

/** Mismo patrón que `components/rankings/RankingViewToggle.tsx`: enlaces reales, no
 * estado local — cada categoría es compartible y navegable con el historial. Los
 * filtros activos se conservan al cambiar de categoría (antes se perdían). */
export function StatGroupTabs({ current, query = "" }: { current: StatGroup; query?: string }) {
  return (
    <div role="navigation" aria-label="Stat categories" className="scrollbar-hidden flex gap-2 overflow-x-auto pb-1">
      {STAT_GROUPS.map((g) => (
        <Link
          key={g.value}
          href={`/stats?group=${g.value}${query}`}
          aria-current={g.value === current ? "page" : undefined}
          className={`text-eyebrow shrink-0 rounded-full px-4 py-2.5 text-xs whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
            g.value === current ? "bg-accent-500 text-navy-900" : "bg-rule/60 text-muted-label hover:bg-rule hover:text-ink"
          }`}
        >
          {g.label}
        </Link>
      ))}
    </div>
  );
}
