"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addOrRefreshTournament } from "@/app/admin/tournaments/actions";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/tournamentStatus";

export function AddTournamentForm() {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{
    editionId: number;
    eventName: string;
    year: number;
    statusLabel: string;
    matchCount: number;
    wasNewEdition: boolean;
  } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    startTransition(async () => {
      setError(null);
      const { result, error } = await addOrRefreshTournament(input);
      if (error) {
        setError(error);
        return;
      }
      setLast({
        editionId: result!.editionId,
        eventName: result!.eventName,
        year: result!.year,
        statusLabel: TOURNAMENT_STATUS_LABEL[result!.status],
        matchCount: result!.matchCount,
        wasNewEdition: result!.wasNewEdition,
      });
      setInput("");
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-paper p-5">
      <h2 className="text-headline mb-1 text-lg text-ink">Add or refresh a tournament</h2>
      <p className="text-muted-label mb-4 text-xs">
        Paste a Trn number (e.g. "2095") or the full OT_ViewTournament.php URL. Fetches the page live from
        the Mana Games forum and loads it — works whether the tournament is still in registration, in progress,
        or finished. Running this again for the same tournament replaces its matches with whatever is on the
        site now.
      </p>
      <p className="text-muted-label mb-4 rounded-md bg-paper-tint px-3 py-2 text-xs">
        Requires this admin panel to be running locally with a Chromium browser available (same as the
        backfill scraper) — it will not work on a deployed serverless instance.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="2095 or https://www.managames.com/Forum/OT_ViewTournament.php?Trn=2095"
          disabled={isPending}
          className="text-ink flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="text-eyebrow shrink-0 rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Fetching…" : "Fetch & load"}
        </button>
      </form>

      {error && <p className="text-down mt-3 text-xs">{error}</p>}

      {last && (
        <p className="text-muted-label mt-3 text-xs">
          {last.wasNewEdition ? "Added" : "Refreshed"}{" "}
          <Link href={`/tournaments/${last.editionId}`} className="text-blue-500 hover:underline">
            {last.eventName} {last.year}
          </Link>{" "}
          — {last.statusLabel}
          {last.matchCount > 0 && `, ${last.matchCount} matches`}.
        </p>
      )}
    </div>
  );
}
