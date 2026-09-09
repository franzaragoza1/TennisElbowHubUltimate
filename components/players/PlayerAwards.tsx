import Link from "next/link";
import { getAwardCategory } from "@/lib/awards/catalog";
import { periodLabel } from "@/lib/awards/format";
import type { PlayerAwardWin } from "@/lib/awards/queries";

interface CategoryGroupPeriod {
  id: number;
  label: string;
}

interface CategoryGroup {
  categoryKey: string;
  count: number;
  /** "September 2026", más reciente primero — getPlayerAwardWins ya llega ordenado así. */
  periods: CategoryGroupPeriod[];
}

/**
 * Derivado de premios ya decididos por votación real (lib/awards/queries.ts::
 * getPlayerAwardWins), nunca autodeclarado — mismo criterio que PlayerPalmares.tsx
 * para los títulos de torneo. Sin premios que enseñar, la sección no aparece.
 * Agrupado por categoría (una fila por categoría, no un premio por fila), igual que
 * Palmares agrupa por categoría de torneo.
 */
export function PlayerAwards({ wins }: { wins: PlayerAwardWin[] }) {
  if (wins.length === 0) return null;

  const groups = new Map<string, CategoryGroup>();
  for (const w of wins) {
    if (!groups.has(w.categoryKey)) groups.set(w.categoryKey, { categoryKey: w.categoryKey, count: 0, periods: [] });
    const group = groups.get(w.categoryKey)!;
    group.count += 1;
    group.periods.push({ id: w.period.id, label: periodLabel(w.period) });
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.count - a.count);

  return (
    <div>
      <h2 className="text-headline mb-4 text-lg text-ink">
        Awards{" "}
        <span className="text-muted-label text-sm font-normal">
          &middot; {wins.length} award{wins.length === 1 ? "" : "s"}
        </span>
      </h2>
      <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="text-eyebrow px-4 py-2 text-xs text-muted-label">Category</th>
                <th className="text-eyebrow w-16 px-3 py-2 text-right text-xs text-muted-label">Won</th>
                <th className="text-eyebrow px-4 py-2 text-xs text-muted-label">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const category = getAwardCategory(row.categoryKey);
                return (
                  <tr key={row.categoryKey} className="border-b border-b-rule last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="text-eyebrow inline-flex items-center gap-1 rounded-full border border-accent-500/40 bg-accent-500/10 px-2 py-0.5 text-[10px] text-ink">
                        <span aria-hidden="true">{category?.emoji}</span>
                        {category?.label ?? row.categoryKey}
                      </span>
                    </td>
                    <td className="tour-numeric px-3 py-2.5 text-right text-sm text-ink">{row.count}</td>
                    <td className="px-4 py-2.5 text-sm text-ink">
                      {row.periods.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ", "}
                          <Link href={`/awards/${p.id}`} className="hover:text-blue-500 hover:underline">
                            {p.label}
                          </Link>
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
