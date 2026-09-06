"use client";

import { useState } from "react";
import { recordMatchResult } from "@/app/admin/native-tournaments/[id]/actions";

const OUTCOMES = [
  { value: "played", label: "Played" },
  { value: "walkover", label: "Walkover" },
  { value: "retired", label: "Retired" },
  { value: "disqualified", label: "Disqualified" },
];

export function ResultEntryForm({
  pendingSlotId,
  round,
  player1: { id: player1Id, name: player1Name },
  player2: { id: player2Id, name: player2Name },
}: {
  pendingSlotId: number;
  round: string;
  player1: { id: number; name: string };
  player2: { id: number; name: string };
}) {
  const [outcome, setOutcome] = useState("played");

  return (
    <form action={recordMatchResult} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper px-3 py-2">
      <input type="hidden" name="pendingSlotId" value={pendingSlotId} />
      <span className="text-eyebrow shrink-0 text-[10px] text-muted-label">{round}</span>

      <select name="winnerId" required defaultValue="" className="rounded border border-rule px-2 py-1 text-sm text-ink">
        <option value="" disabled>
          Winner…
        </option>
        <option value={player1Id}>{player1Name}</option>
        <option value={player2Id}>{player2Name}</option>
      </select>

      <select name="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="rounded border border-rule px-2 py-1 text-sm text-ink">
        {OUTCOMES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {outcome === "played" && (
        <>
          <input name="set" placeholder="6-4" className="w-16 rounded border border-rule px-2 py-1 text-sm text-ink" />
          <input name="set" placeholder="6-4" className="w-16 rounded border border-rule px-2 py-1 text-sm text-ink" />
          <input name="set" placeholder="6-4 (opt.)" className="w-20 rounded border border-rule px-2 py-1 text-sm text-ink" />
        </>
      )}

      <button type="submit" className="text-eyebrow text-xs text-blue-500 hover:underline">
        Save
      </button>
    </form>
  );
}
