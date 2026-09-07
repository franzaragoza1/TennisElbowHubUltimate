"use client";

import { useEffect, useState, useTransition } from "react";
import { searchPlayers, type PlayerSearchRow } from "@/app/admin/players/actions";
import { registerPlayer } from "@/app/admin/native-tournaments/[id]/actions";

export function RegistrationSearch({ editionId, onRegistered }: { editionId: number; onRegistered: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => {
      searchPlayers(query).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) setResults([]);
  }

  function handleRegister(playerId: number, seed: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("editionId", String(editionId));
      formData.set("playerId", String(playerId));
      formData.set("seed", seed);
      await registerPlayer(formData);
      onRegistered();
    });
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search a player to register…"
        className="w-full max-w-sm rounded border border-rule px-3 py-2 text-sm text-ink"
      />
      {results.length > 0 && (
        <div className="mt-2 max-w-sm overflow-hidden rounded-lg border border-rule bg-paper">
          {results.map((p) => (
            <RegistrationSearchRow key={p.id} player={p} isPending={isPending} onRegister={handleRegister} />
          ))}
        </div>
      )}
    </div>
  );
}

function RegistrationSearchRow({
  player,
  isPending,
  onRegister,
}: {
  player: PlayerSearchRow;
  isPending: boolean;
  onRegister: (playerId: number, seed: string) => void;
}) {
  const [seed, setSeed] = useState("");
  return (
    <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2 text-sm last:border-0">
      <span className="text-ink truncate">{player.displayName}</span>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="number"
          min={1}
          placeholder="Seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          className="w-16 rounded border border-rule px-2 py-1 text-xs text-ink"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => onRegister(player.id, seed)}
          className="text-eyebrow text-xs text-blue-500 hover:underline disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
