"use client";

import { useEffect, useState, useTransition } from "react";
import { requestPlayerClaim, searchClaimablePlayers, type ClaimablePlayerRow } from "@/app/account/actions";

export function ClaimPlayerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClaimablePlayerRow[]>([]);
  const [requestedId, setRequestedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => {
      searchClaimablePlayers(query).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) setResults([]);
  }

  function handleClaim(playerId: number) {
    startTransition(async () => {
      await requestPlayerClaim(playerId);
      setRequestedId(playerId);
    });
  }

  if (requestedId !== null) {
    return (
      <p className="text-muted-label rounded-lg border border-rule bg-paper-tint px-4 py-3 text-sm">
        Request sent — an admin needs to approve it before this profile is linked to your account.
      </p>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search for your player name…"
        className="w-full rounded border border-rule px-3 py-2 text-sm text-ink"
      />
      {results.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-rule bg-paper">
          {results.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2 text-sm last:border-0">
              <span className="text-ink">{p.displayName}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleClaim(p.id)}
                className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline disabled:opacity-50"
              >
                This is me
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
