import type { SplitRow } from "@/lib/h2hStats";

/**
 * Desglose del enfrentamiento por superficie / categoría / ronda. Una barra partida
 * por cruce, con la cuota de cada jugador en su color (azul y lima, como pide
 * CLAUDE.md §6 para esta pantalla).
 */
export function H2HSplitTable({ title, rows }: { title: string; rows: SplitRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div>
      <p className="text-eyebrow mb-3 text-[11px] text-white/50">{title}</p>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const total = r.player1Wins + r.player2Wins;
          const pct1 = total > 0 ? (r.player1Wins / total) * 100 : 0;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="tour-numeric w-6 shrink-0 text-right text-sm text-white">
                {r.player1Wins}
              </span>
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div style={{ width: `${pct1}%`, backgroundColor: "var(--blue-500)" }} />
                <div style={{ width: `${100 - pct1}%`, backgroundColor: "var(--accent-500)" }} />
              </div>
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
