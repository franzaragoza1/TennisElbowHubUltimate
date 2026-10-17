import type { StatGroupInfo } from "@/lib/statGroups";

/**
 * Qué mide la categoría y cómo se calcula su cifra de cabecera, siempre visible bajo los
 * filtros (rediseño de Stats, 2026-10-17) — antes la tabla enseñaba un "Rating" sin decir
 * de qué estaba hecho. Si la fórmula de la ATP lleva algo que aquí no se puede calcular
 * de verdad (quién sacaba cada juego), se dice: no se rellena con una aproximación.
 */
export function StatGroupNote({ group }: { group: StatGroupInfo }) {
  return (
    <aside aria-label={`How ${group.label} is calculated`} className="mb-4 rounded-lg border border-rule bg-paper px-4 py-3 text-sm leading-relaxed">
      <p className="text-ink">{group.blurb}</p>
      <p className="text-muted-label mt-1">{group.formula}</p>
      {group.requirement && <p className="text-muted-label mt-1">{group.requirement}</p>}
      {group.leftOut && <p className="text-muted-label mt-1 text-xs">{group.leftOut}</p>}
      <p className="text-muted-label mt-1 text-xs">
        Players need at least 5 matches with recorded stats in the period. Click a column to sort by it.
      </p>
    </aside>
  );
}
