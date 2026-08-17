"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RankedWeek {
  isoYear: number;
  isoWeek: number;
}

export function RankingFilters({
  weeks,
  currentWeek,
  currentTop,
  topOptions,
  showWeekPicker = true,
  children,
}: {
  weeks: RankedWeek[];
  currentWeek: RankedWeek;
  currentTop: number;
  topOptions: number[];
  /** La Race solo tiene sentido en su semana más reciente (ver docs/decisiones.md) —
   * no se deja elegir una semana pasada, así que el selector ni se enseña. */
  showWeekPicker?: boolean;
  /** Controles adicionales (p.ej. el toggle de en vivo) en la misma fila de píldoras. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const weekValue = `${currentWeek.isoYear}-${currentWeek.isoWeek}`;

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {showWeekPicker && (
        <Select value={weekValue} onValueChange={(v) => updateParam("week", v)}>
          <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 bg-black text-xs font-semibold text-white shadow-sm focus-visible:ring-accent-500/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={`${w.isoYear}-${w.isoWeek}`} value={`${w.isoYear}-${w.isoWeek}`}>
                {w.isoYear} — Week {w.isoWeek}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={String(currentTop)} onValueChange={(v) => updateParam("top", v)}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 bg-black text-xs font-semibold text-white shadow-sm focus-visible:ring-accent-500/70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {topOptions.map((n) => (
            <SelectItem key={n} value={String(n)}>
              Top {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {children}
    </div>
  );
}
