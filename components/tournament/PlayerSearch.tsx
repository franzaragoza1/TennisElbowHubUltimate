"use client";

import { useId, useMemo, useState } from "react";
import type { PathPlayer } from "@/lib/bracketPath";

const MAX_RESULTS = 8;

function rank(player: PathPlayer, query: string): number {
  return player.displayName.toLowerCase().startsWith(query) ? 0 : 1;
}

/**
 * Buscador de jugador del cuadro — la única forma de seguir el recorrido de alguien
 * (pedido del propietario, 2026-09-26: "don't activate path tracing by clicking on the
 * player, rather have a search bar on the draw"). Combobox accesible: flechas + Enter
 * + Escape, y un clic/toque en un resultado.
 */
export function PlayerSearch({ players, onSelect }: { players: PathPlayer[]; onSelect: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .sort((a, b) => rank(a, q) - rank(b, q) || (a.seed ?? Infinity) - (b.seed ?? Infinity) || a.displayName.localeCompare(b.displayName))
      .slice(0, MAX_RESULTS);
  }, [players, query]);

  function choose(player: PathPlayer) {
    onSelect(player.id);
    setQuery("");
    setOpen(false);
    setActive(0);
  }

  const expanded = open && query.trim() !== "";

  return (
    <div className="relative min-w-[200px] flex-1">
      <input
        type="text"
        role="combobox"
        aria-label="Search a player in the draw"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && results[active] ? `${listId}-${results[active].id}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search a player…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && expanded && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-full border border-rule bg-paper px-4 py-2 text-base text-ink placeholder:text-muted-label focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
      />
      {expanded && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-rule bg-paper shadow-md">
          {results.length === 0 && <li className="text-muted-label px-4 py-2 text-sm">No player in this draw matches.</li>}
          {results.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={i === active}
              // onMouseDown, no onClick: el `blur` del input cerraría la lista antes de que
              // llegase el clic y el resultado nunca se elegiría.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              className={`flex cursor-pointer items-baseline gap-2 px-4 py-2 text-base ${i === active ? "bg-navy-900 text-white" : "text-ink"}`}
            >
              <span className="tour-numeric w-5 shrink-0 text-xs opacity-70">{p.seed ?? ""}</span>
              <span className="min-w-0 truncate">{p.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
