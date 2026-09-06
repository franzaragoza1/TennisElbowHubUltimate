"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Misma barra de píldoras que RankingFilters (mismo componente `Select`, mismos
 * estilos) — categoría/superficie/estado del calendario de torneos. Las opciones
 * ofrecidas ya vienen filtradas por `app/tournaments/page.tsx` a lo que de verdad
 * aparece en la temporada elegida, así que ningún filtro lleva nunca a una lista
 * vacía por sí solo (CLAUDE.md: nunca ofrecer lo que no está respaldado por datos). */
export function TournamentFilters({
  categories,
  currentCategory,
  surfaces,
  currentSurface,
  statuses,
  currentStatus,
}: {
  categories: string[];
  currentCategory: string;
  surfaces: string[];
  currentSurface: string;
  statuses: { value: string; label: string }[];
  currentStatus: string;
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

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Select value={currentCategory} onValueChange={(v) => updateParam("category", v)}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 !bg-black text-xs font-semibold !text-white shadow-sm focus-visible:ring-accent-500/70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSurface} onValueChange={(v) => updateParam("surface", v)}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 !bg-black text-xs font-semibold !text-white shadow-sm focus-visible:ring-accent-500/70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All surfaces</SelectItem>
          {surfaces.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentStatus} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="text-eyebrow w-auto rounded-full border border-white/15 !bg-black text-xs font-semibold !text-white shadow-sm focus-visible:ring-accent-500/70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
