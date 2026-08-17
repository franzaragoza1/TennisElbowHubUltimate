"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

export interface PlayerIndexRow {
  id: number;
  displayName: string;
  country: string | null;
  character: string | null;
  currentRank: number | null;
  wins: number;
  losses: number;
  titles: number;
}

type SortKey = "rank" | "name" | "titles";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Ranking" },
  { key: "name", label: "Name" },
  { key: "titles", label: "Titles" },
];

/** Los jugadores sin ranking actual (retirados, inactivos) van al final, no arriba. */
const UNRANKED = Number.MAX_SAFE_INTEGER;

export function PlayerIndex({ players }: { players: PlayerIndexRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rank");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? players.filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            (p.country ?? "").toLowerCase().includes(q),
        )
      : players;

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "titles") return b.titles - a.titles || a.displayName.localeCompare(b.displayName);
      return (a.currentRank ?? UNRANKED) - (b.currentRank ?? UNRANKED);
    });
  }, [players, query, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or country…"
          className="w-full rounded-full border border-rule bg-paper px-5 py-2.5 text-ink outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30 sm:max-w-sm"
        />
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`tap-scale text-eyebrow rounded-full px-4 py-2 text-xs transition ${
                sort === s.key
                  ? "bg-navy-900 text-white"
                  : "border border-rule bg-paper text-muted-label hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-muted-label tour-numeric text-xs sm:ml-auto">
          {visible.length} of {players.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-label py-12 text-center">No players match that search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p, i) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="row-reveal hover-lift flex items-center gap-3 rounded-lg border border-rule bg-paper p-3 transition hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              style={{ "--reveal-delay": `${Math.min(i, 24) * 12}ms` } as React.CSSProperties}
            >
              <PlayerAvatar
                displayName={p.displayName}
                country={p.country}
                character={p.character}
              />
              <div className="min-w-0 flex-1">
                <p className="text-headline truncate text-ink">{p.displayName}</p>
                <p className="tour-numeric text-muted-label truncate text-xs">
                  {p.currentRank ? `No. ${p.currentRank}` : "Unranked"} · {p.wins}-{p.losses}
                  {p.titles > 0 ? ` · ${p.titles} ${p.titles === 1 ? "title" : "titles"}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
