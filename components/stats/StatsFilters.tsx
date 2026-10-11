"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SurfaceFamily } from "@/lib/surfaceColors";
import { FILTER_PILL } from "@/components/filters/filterPill";

/** Mismo patrón que components/rankings/RankingFilters.tsx: pastillas dirigidas por
 * parámetro de URL, no estado local — así el enlace a una vista filtrada concreta se
 * puede compartir/recargar tal cual. */
export function StatsFilters({
  years,
  surfaces,
  currentTier,
  currentPeriod,
  currentSurface,
}: {
  years: number[];
  surfaces: SurfaceFamily[];
  currentTier: "all" | 10 | 20 | 50;
  currentPeriod: "52w" | "career" | number;
  currentSurface: "all" | SurfaceFamily;
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

  const triggerClass = FILTER_PILL;
  // `items`: etiqueta en el botón cerrado (2026-10-11), ver RankingFilters.
  const tierItems = [
    { value: "all", label: "Versus All Players" },
    { value: "10", label: "Versus Top 10 Players" },
    { value: "20", label: "Versus Top 20 Players" },
    { value: "50", label: "Versus Top 50 Players" },
  ];
  const periodItems = [{ value: "52w", label: "52 Weeks" }, { value: "career", label: "Career" }, ...years.map((y) => ({ value: String(y), label: String(y) }))];
  const surfaceItems = [{ value: "all", label: "All Surfaces" }, ...surfaces.map((x) => ({ value: x, label: x }))];

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Select items={tierItems} value={String(currentTier)} onValueChange={(v) => updateParam("tier", v)}>
        <SelectTrigger className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Versus All Players</SelectItem>
          <SelectItem value="10">Versus Top 10 Players</SelectItem>
          <SelectItem value="20">Versus Top 20 Players</SelectItem>
          <SelectItem value="50">Versus Top 50 Players</SelectItem>
        </SelectContent>
      </Select>

      <Select items={periodItems} value={String(currentPeriod)} onValueChange={(v) => updateParam("period", v)}>
        <SelectTrigger className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="52w">52 Weeks</SelectItem>
          <SelectItem value="career">Career</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={surfaceItems} value={currentSurface} onValueChange={(v) => updateParam("surface", v)}>
        <SelectTrigger className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Surfaces</SelectItem>
          {surfaces.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
