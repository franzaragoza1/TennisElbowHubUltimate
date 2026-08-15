"use client";

import Link from "next/link";
import { matchKey, useLiveScores } from "@/lib/liveTennis/useLiveScores";

export function PlayerLiveBanner({ playerId }: { playerId: number }) {
  const { matches, commentaryByMatch } = useLiveScores();

  const live = matches?.find((m) => m.player1.id === playerId || m.player2.id === playerId);
  if (!live) return null;

  const isPlayer1 = live.player1.id === playerId;
  const self = isPlayer1 ? live.player1 : live.player2;
  const opponent = isPlayer1 ? live.player2 : live.player1;
  const commentary = commentaryByMatch.get(matchKey(live)) ?? null;

  return (
    <Link
      href={`/tournaments/${live.editionId}`}
      className="block border-b border-white/10 bg-navy-800 transition-colors hover:bg-navy-700"
    >
      <div className="tour-container flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-eyebrow flex shrink-0 items-center gap-1 rounded-full bg-down px-2 py-0.5 text-[10px] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
            LIVE
          </span>
          <p className="text-sm text-white">
            Playing now vs{" "}
            <span className="text-headline text-white">{opponent.displayName}</span> —{" "}
            <span className="tour-numeric">
              {self.setGames.join("-")} {self.currentPoint && `· ${self.currentPoint}`}
            </span>
          </p>
          {commentary && <p className="text-xs text-white/60 italic">{commentary}</p>}
        </div>
        <span className="text-eyebrow shrink-0 text-xs text-accent-500">{live.tournamentName} · View draw</span>
      </div>
    </Link>
  );
}
