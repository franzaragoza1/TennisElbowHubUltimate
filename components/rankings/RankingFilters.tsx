"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CountryFilterOption } from "@/lib/countryCodes";

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
  countries,
  currentCountry,
  children,
}: {
  weeks: RankedWeek[];
  currentWeek: RankedWeek;
  currentTop: number;
  topOptions: number[];
  /** La Race solo tiene sentido en su semana más reciente (ver docs/decisiones.md) —
   * no se deja elegir una semana pasada, así que el selector ni se enseña. */
  showWeekPicker?: boolean;
  /** Países que de verdad aparecen en la vista actual (ya recortada a Top N), agrupados
   * por país real (ver lib/countryCodes.ts::groupCountriesForFilter) — nunca un
   * catálogo fijo, para no ofrecer un país que hoy no tiene a nadie dentro del corte
   * (CLAUDE.md §6, "país" en la barra de filtros del ranking). Sin agrupar, "USA",
   * "U.S.", "United States"... salían como entradas separadas del mismo país. */
  countries: CountryFilterOption[];
  currentCountry: string;
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
          <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 !bg-black text-xs font-semibold !text-white shadow-sm focus-visible:ring-accent-500/70">
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
        <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 !bg-black text-xs font-semibold !text-white shadow-sm focus-visible:ring-accent-500/70">
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

      {countries.length > 0 && (
        <Select value={currentCountry} onValueChange={(v) => updateParam("country", v)}>
          <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 !bg-black text-xs font-semibold !text-white shadow-sm focus-visible:ring-accent-500/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                <span className="flex items-center gap-2">
                  {c.code && (
                    // eslint-disable-next-line @next/next/no-img-element -- icono decorativo diminuto, no vale la pena el pipeline de next/image
                    <img
                      src={`/flags/${c.code.toLowerCase()}.svg`}
                      alt=""
                      className="h-3 w-4 shrink-0 overflow-hidden rounded-sm bg-rule object-cover"
                    />
                  )}
                  {c.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {children}
    </div>
  );
}
