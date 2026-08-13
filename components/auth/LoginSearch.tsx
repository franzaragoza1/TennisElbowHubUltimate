"use client";

import { useState, useTransition } from "react";
import { loginAsPlayer } from "@/app/login/actions";

export interface PlayerOption {
  id: number;
  displayName: string;
}

export function LoginSearch({ players }: { players: PlayerOption[] }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered =
    query.trim().length === 0
      ? []
      : players
          .filter((p) => p.displayName.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 8);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your player name…"
        autoFocus
        className="w-full rounded-lg border border-rule px-3 py-2 text-navy-900 outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30"
      />
      {filtered.length > 0 && (
        <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-lg border border-rule">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => loginAsPlayer(p.id))}
                className="text-headline w-full px-3 py-2.5 text-left text-navy-900 hover:bg-rule/50 disabled:opacity-50"
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
