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
}: {
  weeks: RankedWeek[];
  currentWeek: RankedWeek;
  currentTop: number;
  topOptions: number[];
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
      <Select value={weekValue} onValueChange={(v) => updateParam("week", v)}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border-none bg-navy-900 text-xs text-white focus-visible:ring-accent-500/70">
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

      <Select value={String(currentTop)} onValueChange={(v) => updateParam("top", v)}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border-none bg-navy-900 text-xs text-white focus-visible:ring-accent-500/70">
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
    </div>
  );
}
