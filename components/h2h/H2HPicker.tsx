"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PlayerOption {
  id: number;
  displayName: string;
}

function PlayerSearchBox({
  label,
  players,
  selected,
  onSelect,
  onClear,
}: {
  label: string;
  players: PlayerOption[];
  selected: PlayerOption | null;
  onSelect: (player: PlayerOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered =
    query.trim().length === 0
      ? []
      : players
          .filter((p) => p.displayName.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 8);

  if (selected) {
    return (
      <div>
        <p className="text-eyebrow mb-1 text-[11px] text-white/50">{label}</p>
        <div className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2.5">
          <span className="text-headline truncate text-white">{selected.displayName}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-eyebrow shrink-0 text-[11px] text-white/50 hover:text-white"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <p className="text-eyebrow mb-1 text-[11px] text-white/50">{label}</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a player…"
        className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      />
      {filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-rule bg-paper shadow-lg">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                }}
                className="text-headline w-full truncate px-4 py-2.5 text-left text-ink hover:bg-paper-tint"
              >
                {p.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function H2HPicker({ players }: { players: PlayerOption[] }) {
  const router = useRouter();
  const [player1, setPlayer1] = useState<PlayerOption | null>(null);
  const [player2, setPlayer2] = useState<PlayerOption | null>(null);

  const sameTwice = player1 !== null && player2 !== null && player1.id === player2.id;
  const canCompare = player1 !== null && player2 !== null && !sameTwice;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <PlayerSearchBox
            label="Player 1"
            players={players}
            selected={player1}
            onSelect={setPlayer1}
            onClear={() => setPlayer1(null)}
          />
        </div>
        <div className="flex-1">
          <PlayerSearchBox
            label="Player 2"
            players={players}
            selected={player2}
            onSelect={setPlayer2}
            onClear={() => setPlayer2(null)}
          />
        </div>
        <button
          type="button"
          disabled={!canCompare}
          onClick={() => router.push(`/h2h/${player1!.id}/${player2!.id}`)}
          className="text-eyebrow shrink-0 rounded-lg bg-accent-500 px-6 py-2.5 text-xs text-navy-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          Compare
        </button>
      </div>
      {sameTwice && (
        <p className="mt-2 text-sm text-down">Pick two different players.</p>
      )}
    </div>
  );
}
