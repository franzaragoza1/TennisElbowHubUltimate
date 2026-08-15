import type { SplitRow } from "@/lib/h2hStats";
import { CenterBar } from "./CenterBar";

/**
 * Desglose del enfrentamiento por superficie / categoría / ronda. Misma barra que
 * crece desde el centro que el resto del H2H (`CenterBar`, compartida con
 * `H2HStatsRow`) — antes era una barra apilada de ancho fijo (los dos valores siempre
 * sumaban el 100% del ancho), así que "1 contra 0" se veía tan "llena" como "10 contra
 * 8": no representaba el tamaño real de la muestra, solo el reparto dentro de ella.
 */
export function H2HSplitTable({ title, rows }: { title: string; rows: SplitRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div>
      <p className="text-eyebrow mb-3 text-[11px] text-white/50">{title}</p>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const max = Math.max(r.player1Wins, r.player2Wins, 1);
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="tour-numeric w-6 shrink-0 text-right text-sm text-white">
                {r.player1Wins}
              </span>
              <CenterBar value={r.player1Wins} max={max} color="var(--blue-500)" fromRight />
              <CenterBar value={r.player2Wins} max={max} color="var(--accent-500)" fromRight={false} />
              <span className="tour-numeric w-6 shrink-0 text-sm text-white">
                {r.player2Wins}
              </span>
              <span className="w-28 shrink-0 truncate text-right text-xs text-white/60 sm:w-40">
                {r.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
