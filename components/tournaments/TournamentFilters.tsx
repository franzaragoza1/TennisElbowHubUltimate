"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTER_PILL } from "@/components/filters/filterPill";

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

  // `items` en cada `Select` (pase visual, 2026-10-11): sin la lista, Base UI no sabe
  // qué etiqueta va con cada valor hasta abrir el desplegable, y el botón cerrado
  // enseñaba el valor crudo ("ALL" tres veces, sin decir de qué). Píldoras con los
  // colores del tema en vez de negro fijo (en el tema claro eran tres manchas negras).
  const filters = [
    { key: "category", value: currentCategory, items: [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))] },
    { key: "surface", value: currentSurface, items: [{ value: "all", label: "All surfaces" }, ...surfaces.map((c) => ({ value: c, label: c }))] },
    { key: "status", value: currentStatus, items: [{ value: "all", label: "All statuses" }, ...statuses] },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {filters.map((f) => (
        <Select key={f.key} items={f.items} value={f.value} onValueChange={(v) => updateParam(f.key, v)}>
          <SelectTrigger aria-label={`Filter by ${f.key}`} className={FILTER_PILL}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {f.items.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}

