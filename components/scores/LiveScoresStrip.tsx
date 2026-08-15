"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { roundPhrase } from "@/lib/roundPhrase";
import { matchKey, useLiveScores } from "@/lib/liveTennis/useLiveScores";
import type { LiveTourMatch, LiveMatchPlayer } from "@/lib/liveTennis/resolveAgainstOngoing";

function PlayerRow({ player }: { player: LiveMatchPlayer }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <Link href={`/players/${player.id}`} className="text-ink flex-1 whitespace-nowrap text-sm hover:underline">
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

function LiveMatchCard({ match, commentary }: { match: LiveTourMatch; commentary: string | null }) {
  return (
    <div
      className="shrink-0 rounded-lg border border-rule bg-paper px-4 py-3 shadow-sm"
      style={{ minWidth: 280 }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-eyebrow text-[10px] whitespace-nowrap text-muted-label">{match.tournamentName}</p>
        <span className="text-eyebrow flex shrink-0 items-center gap-1 text-[10px] text-down">
          <span className="bg-down h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" />
          LIVE
        </span>
      </div>
      <p className="text-eyebrow mb-1 text-[9px] text-muted-label">{roundPhrase(match.round, match.drawSize)}</p>
      <PlayerRow player={match.player1} />
      <PlayerRow player={match.player2} />
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-rule pt-1.5">
        {commentary && <p className="text-muted-label flex-1 text-xs italic">{commentary}</p>}
        <Link
          href={`/tournaments/${match.editionId}`}
          className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1 text-[10px] text-blue-500 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Draw
        </Link>
      </div>
    </div>
  );
}

export function LiveScoresStrip() {
  const { matches, commentaryByMatch } = useLiveScores();

  if (!matches || matches.length === 0) return null;

  return (
    <div className="tour-container py-4">
      <p className="text-eyebrow mb-2 text-[10px] text-muted-label">Live now</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {matches.map((m) => (
          <LiveMatchCard key={matchKey(m)} match={m} commentary={commentaryByMatch.get(matchKey(m)) ?? null} />
        ))}
      </div>
    </div>
  );
}
