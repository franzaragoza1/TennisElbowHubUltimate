"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { roundPhrase } from "@/lib/roundPhrase";
import { matchKey, useLiveScores } from "@/lib/liveTennis/useLiveScores";
import type { LiveMatchPlayer, LiveTourMatch } from "@/lib/liveTennis/resolveAgainstOngoing";

/** Cuántos partidos en vivo caben en el panel antes de que "See all" sea la única
 * forma razonable de ver el resto. */
const MAX_SHOWN = 3;

function CompactPlayerRow({ player }: { player: LiveMatchPlayer }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <Link href={`/players/${player.id}`} className="text-ink min-w-0 flex-1 truncate text-xs hover:underline">
        {player.displayName}
      </Link>
      {player.serving && <span aria-label="Serving" className="bg-glow-500 h-1.5 w-1.5 shrink-0 rounded-full" />}
      <div className="tour-numeric flex shrink-0 items-center gap-1.5">
        {player.setGames.map((g, i) => (
          <span key={i} className="text-muted-label w-3 text-center text-xs">
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompactMatch({ match }: { match: LiveTourMatch }) {
  return (
    <div className="border-b border-rule py-2 last:border-0 last:pb-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-eyebrow truncate text-[10px] text-muted-label">
          {match.tournamentName} · {roundPhrase(match.round, match.drawSize)}
        </p>
        <span className="text-eyebrow flex shrink-0 items-center gap-1 text-[9px] text-down">
          <span className="bg-down h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" />
          LIVE
        </span>
      </div>
      <CompactPlayerRow player={match.player1} />
      <CompactPlayerRow player={match.player2} />
    </div>
  );
}

/** Vertical del sidebar, no la tira horizontal de `LiveScoresStrip` — mismo hook
 * compartido (`useLiveScores`), otra forma de pintarlo. Sin partidos en vivo ahora
 * mismo, un estado vacío en vez de un hueco en blanco. */
export function ScoresWidget() {
  const { matches } = useLiveScores();

  return (
    <SidebarPanel title="SCORES" href="/scores">
      {matches === null ? (
        <p className="text-muted-label text-xs">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="text-muted-label text-xs">No live matches right now.</p>
      ) : (
        matches.slice(0, MAX_SHOWN).map((m) => <CompactMatch key={matchKey(m)} match={m} />)
      )}
    </SidebarPanel>
  );
}
