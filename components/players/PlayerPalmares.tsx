import Link from "next/link";
import { categoryColorHex, categoryRank, categoryTextColor } from "@/lib/categoryColor";
import type { PalmaresTitle } from "@/lib/h2hStats";

interface CategoryGroupTitle {
  editionId: number;
  label: string;
}

interface CategoryGroup {
  category: string;
  count: number;
  /** "Montreal 2026", más reciente primero — `getPalmares` ya llega ordenado así. */
  titles: CategoryGroupTitle[];
}

/**
 * Derivado de partidos reales (`lib/h2hStats.ts::getPalmares`), nunca autodeclarado
 * — sin títulos que enseñar, la sección no aparece. Agrupado por categoría (una fila
 * por categoría, no un título por fila) y ordenado por importancia real del circuito
 * (Grand Slam primero, Future último — `lib/categoryColor.ts::categoryRank`, mismo
 * criterio que ya decide el color de cada una).
 */
export function PlayerPalmares({ titles }: { titles: PalmaresTitle[] }) {
  if (titles.length === 0) return null;

  const groups = new Map<string, CategoryGroup>();
  for (const t of titles) {
    if (!groups.has(t.category)) groups.set(t.category, { category: t.category, count: 0, titles: [] });
    const group = groups.get(t.category)!;
    group.count += 1;
    group.titles.push({ editionId: t.editionId, label: `${t.eventName} ${t.year}` });
  }

  const rows = Array.from(groups.values()).sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category) || b.count - a.count,
  );

  return (
    <div>
      <h2 className="text-headline mb-4 text-lg text-ink">
        Palmares{" "}
        <span className="text-muted-label text-sm font-normal">
          &middot; {titles.length} title{titles.length === 1 ? "" : "s"}
        </span>
      </h2>
      <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="text-eyebrow px-4 py-2 text-xs text-muted-label">Category</th>
              <th className="text-eyebrow w-16 px-3 py-2 text-right text-xs text-muted-label">Won</th>
              <th className="text-eyebrow px-4 py-2 text-xs text-muted-label">Titles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="border-b border-b-rule last:border-b-0">
                <td className="px-4 py-2.5">
                  <span
                    className="text-eyebrow inline-flex items-center rounded-full px-2 py-0.5 text-[10px]"
                    style={{ backgroundColor: categoryColorHex(row.category), color: categoryTextColor(row.category) }}
                  >
                    {row.category}
                  </span>
                </td>
                <td className="tour-numeric px-3 py-2.5 text-right text-sm text-ink">{row.count}</td>
                <td className="px-4 py-2.5 text-sm text-ink">
                  {row.titles.map((t, i) => (
                    <span key={t.editionId}>
                      {i > 0 && ", "}
                      <Link href={`/tournaments/${t.editionId}`} className="hover:text-blue-500 hover:underline">
                        {t.label}
                      </Link>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
