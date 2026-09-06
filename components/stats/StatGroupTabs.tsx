import Link from "next/link";

export type StatGroup = "serve" | "return" | "pressure";

const GROUPS: { value: StatGroup; label: string }[] = [
  { value: "serve", label: "Serve Leaders" },
  { value: "return", label: "Return Leaders" },
  { value: "pressure", label: "Under Pressure Leaders" },
];

/** Mismo patrón que `components/rankings/RankingViewToggle.tsx`: enlaces reales, no
 * estado local — cada categoría es compartible y navegable con el historial. */
export function StatGroupTabs({ current }: { current: StatGroup }) {
  return (
    <div className="flex flex-wrap gap-2">
      {GROUPS.map((g) => (
        <Link
          key={g.value}
          href={`/stats?group=${g.value}`}
          aria-current={g.value === current ? "page" : undefined}
          className={`text-eyebrow rounded-full px-4 py-2 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
            g.value === current
              ? "bg-accent-500 text-navy-900"
              : "bg-rule/60 text-muted-label hover:bg-rule hover:text-ink"
          }`}
        >
          {g.label}
        </Link>
      ))}
    </div>
  );
}
