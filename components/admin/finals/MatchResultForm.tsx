"use client";

import { useState } from "react";
import { forceWinMatch, saveMatchResult } from "@/app/admin/finals/actions";
import type { FinalsFormat } from "@/lib/finals/format";

export interface MatchResultFormPlayer {
  id: number;
  displayName: string;
}

export function MatchResultForm({
  matchId,
  label,
  player1,
  player2,
  format,
}: {
  matchId: number;
  label: string;
  player1: MatchResultFormPlayer;
  player2: MatchResultFormPlayer;
  format: FinalsFormat;
}) {
  const [setCount, setSetCount] = useState(format.setsToWin);

  return (
    <form className="rounded-lg border border-rule bg-paper p-4">
      <input type="hidden" name="matchId" value={matchId} />
      <p className="text-eyebrow mb-1 text-xs text-muted-label">{label}</p>
      <p className="text-muted-label mb-3 text-[11px]">
        {format.label} — best of {format.setsToWin * 2 - 1}, first to {format.setsToWin} sets
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="winnerId" value={player1.id} required className="accent-ink" />
          {player1.displayName}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="winnerId" value={player2.id} className="accent-ink" />
          {player2.displayName}
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: setCount }).map((_, i) => (
          <input
            key={i}
            name="set"
            placeholder={format.scoreHint}
            className="w-20 rounded border border-rule px-2 py-1 text-center text-sm text-ink"
          />
        ))}
        <button type="button" onClick={() => setSetCount((n) => n + 1)} className="text-eyebrow text-xs text-blue-500 hover:underline">
          + set
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          formAction={saveMatchResult}
          type="submit"
          className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800"
        >
          Save result
        </button>
        <button
          formAction={forceWinMatch}
          type="submit"
          className="text-eyebrow rounded-full border border-down px-4 py-1.5 text-xs text-down hover:bg-down/10"
        >
          Force win (retired)
        </button>
      </div>
    </form>
  );
}
