"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { roundPhrase } from "@/lib/roundPhrase";
import type { LiveTourMatch, LiveMatchPlayer } from "@/lib/liveTennis/resolveAgainstOngoing";

const POLL_INTERVAL_MS = 30_000;

function PlayerRow({ player }: { player: LiveMatchPlayer }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <Link href={`/players/${player.id}`} className="text-ink min-w-0 flex-1 truncate text-sm hover:underline">
        {player.displayName}
        {player.seed && <span className="text-muted-label"> ({player.seed})</span>}
      </Link>
      {player.serving && <span aria-label="Serving" className="bg-glow-500 h-1.5 w-1.5 shrink-0 rounded-full" />}
      <div className="tour-numeric flex shrink-0 items-center gap-2">
        {player.setGames.map((g, i) => (
          <span key={i} className="text-muted-label w-4 text-center text-sm">
            {g}
          </span>
        ))}
        {player.currentPoint && <span className="text-headline text-ink w-6 text-right text-sm">{player.currentPoint}</span>}
      </div>
    </div>
  );
}

function LiveMatchCard({ match }: { match: LiveTourMatch }) {
  return (
    <div
      className="shrink-0 rounded-lg border border-rule bg-paper px-4 py-3 shadow-sm"
      style={{ width: 280 }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-eyebrow text-[10px] text-muted-label truncate">{match.tournamentName}</p>
        <span className="text-eyebrow flex shrink-0 items-center gap-1 text-[10px] text-down">
          <span className="bg-down h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" />
          LIVE
        </span>
      </div>
      <p className="text-eyebrow mb-1 text-[9px] text-muted-label">{roundPhrase(match.round, match.drawSize)}</p>
      <PlayerRow player={match.player1} />
      <PlayerRow player={match.player2} />
      <div className="mt-1.5 flex justify-end border-t border-rule pt-1.5">
        <Link
          href={`/tournaments/${match.editionId}`}
          className="text-eyebrow rounded-full border border-rule px-3 py-1 text-[10px] text-blue-500 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Draw
        </Link>
      </div>
    </div>
  );
}

export function LiveScoresStrip() {
  const [matches, setMatches] = useState<LiveTourMatch[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/live-scores");
        const data = (await res.json()) as { matches: LiveTourMatch[] };
        if (!cancelled) setMatches(data.matches);
      } catch {
        if (!cancelled) setMatches((prev) => prev ?? []);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!matches || matches.length === 0) return null;

  return (
    <div className="tour-container py-4">
      <p className="text-eyebrow mb-2 text-[10px] text-muted-label">Live now</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {matches.map((m) => (
          <LiveMatchCard key={`${m.editionId}-${m.player1.id}-${m.player2.id}`} match={m} />
        ))}
      </div>
    </div>
  );
}
