"use client";

import { useMemo } from "react";
import { summarizePath, type PathLayout, type PathPlayer } from "@/lib/bracketPath";

/** Tope de nombres por ronda — la mitad contraria de un cuadro de 128 puede tener más
 * de 30 jugadores vivos en la ronda de octavos, no cabe en una línea legible. */
const MAX_NAMES = 8;

function sortByStrength(players: PathPlayer[]): PathPlayer[] {
  return [...players].sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || a.displayName.localeCompare(b.displayName));
}

/**
 * Panel del jugador seguido en el cuadro: cuántas rondas le quedan y contra quién puede
 * jugar en cada una, contando solo a los que siguen vivos — pedido del propietario,
 * 2026-09-26. Un solo nombre = rival ya decidido; varios = los que siguen en esa mitad.
 */
export function PathPanel({
  layout,
  selectedId,
  labelByRound,
  onSelect,
  onClear,
}: {
  layout: PathLayout;
  selectedId: number;
  labelByRound: Map<string, string>;
  onSelect: (id: number) => void;
  onClear: () => void;
}) {
  const summary = useMemo(() => summarizePath(layout, selectedId), [layout, selectedId]);
  const player = useMemo(() => {
    for (const node of layout.positionById.values()) {
      if (node.match.player1.id === selectedId) return node.match.player1;
      if (node.match.player2.id === selectedId) return node.match.player2;
    }
    return null;
  }, [layout, selectedId]);
  if (!summary || !player) return null;

  const label = (round: string) => labelByRound.get(round) ?? round;

  return (
    <section aria-label="Player path" className="my-3 rounded-lg border border-rule bg-paper px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-headline min-w-0 truncate text-base">{player.displayName}</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-eyebrow shrink-0 rounded-full border border-rule px-2.5 py-1 text-[10px] text-muted-label transition-colors duration-150 hover:border-navy-900 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
        >
          Clear
        </button>
      </div>

      {summary.status === "champion" && <p className="text-muted-label mt-1 text-sm">Won the title.</p>}

      {summary.status === "eliminated" && (
        <p className="text-muted-label mt-1 text-sm">
          Out in {label(summary.round)}
          {summary.by ? ` — lost to ${summary.by.displayName}` : ""}.
        </p>
      )}

      {summary.status === "alive" && (
        <ul className="mt-2 flex flex-col gap-2">
          {summary.rounds.length === 0 && <li className="text-muted-label text-sm">No rounds left to play.</li>}
          {summary.rounds.map((r) => {
            const sorted = sortByStrength(r.opponents);
            const shown = sorted.slice(0, MAX_NAMES);
            return (
              <li key={r.matchId} className="flex items-baseline gap-2 text-sm">
                <span className="text-eyebrow text-muted-label w-9 shrink-0 text-[10px]">{label(r.round)}</span>
                <span className="min-w-0 flex-1">
                  {sorted.length === 0 && <span className="text-muted-label italic">TBD</span>}
                  {sorted.length === 1 && <span className="text-muted-label mr-1">vs</span>}
                  {shown.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && <span className="text-muted-label">, </span>}
                      <button
                        type="button"
                        onClick={() => onSelect(o.id)}
                        className="text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
                      >
                        {o.seed ? <span className="tour-numeric text-muted-label mr-1 text-xs">{o.seed}</span> : null}
                        {o.displayName}
                      </button>
                    </span>
                  ))}
                  {sorted.length > shown.length && <span className="text-muted-label"> +{sorted.length - shown.length} more</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
