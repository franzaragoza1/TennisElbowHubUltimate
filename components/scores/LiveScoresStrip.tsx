"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { matchKey, useLiveScores } from "@/lib/liveTennis/useLiveScores";
import { completedSetWinners } from "@/lib/liveTennis/liveSetWinners";
import type { LiveTourMatch, LiveMatchPlayer } from "@/lib/liveTennis/resolveAgainstOngoing";

function PlayerIdentity({ player, isServing }: { player: LiveMatchPlayer; isServing: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1.5">
      <span className="h-5 w-7 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <span className="tour-numeric text-muted-label w-4 shrink-0 text-center text-sm">{player.seed ?? ""}</span>
      <Link href={`/players/${player.id}`} className="text-ink min-w-0 flex-1 truncate text-base hover:underline">
        {player.displayName}
      </Link>
      {isServing && <span aria-label="Serving" className="bg-glow-500 h-1.5 w-1.5 shrink-0 rounded-full" />}
    </div>
  );
}

function ScoreRow({ player, wonSets }: { player: LiveMatchPlayer; wonSets: boolean[] }) {
  return (
    <div className="tour-numeric flex items-center gap-2.5 py-1.5">
      {player.setGames.map((g, i) => (
        <span key={i} className={`w-4 text-center text-sm ${wonSets[i] ? "text-headline text-ink" : "text-muted-label"}`}>
          {g}
        </span>
      ))}
      {/* Siempre se pinta (con `w-6` reservado), invisible sin valor — pedido explícito:
          si el elemento entero se omitiera cuando el jugador no tiene punto en curso, la
          fila del otro jugador (que sí lo tiene) se quedaba más ancha y las dos filas
          dejaban de alinear su columna de marcador, mismo bug ya resuelto para
          `outcomeLabel` en MatchCard.tsx::PlayerRow. */}
      <span className={`text-headline text-ink w-6 text-center text-sm ${player.currentPoint ? "" : "invisible"}`}>
        {player.currentPoint || "0"}
      </span>
    </div>
  );
}

function LiveMatchCard({ match, commentary }: { match: LiveTourMatch; commentary: string | null }) {
  const wonSets1 = completedSetWinners(match.player1.setGames, match.player2.setGames);
  const wonSets2 = completedSetWinners(match.player2.setGames, match.player1.setGames);

  return (
    <div className="shrink-0 rounded-lg border border-rule bg-paper px-5 py-4 shadow-sm" style={{ minWidth: 340 }}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-eyebrow text-[10px] whitespace-nowrap text-muted-label">{match.tournamentName}</p>
        <span className="text-eyebrow flex shrink-0 items-center gap-1 text-[10px] text-down">
          <span className="bg-down h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" />
          LIVE
        </span>
      </div>
      <p className="text-eyebrow mb-1.5 text-[9px] text-muted-label">{match.roundLabel}</p>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <PlayerIdentity player={match.player1} isServing={match.player1.serving} />
          <PlayerIdentity player={match.player2} isServing={match.player2.serving} />
        </div>
        <div className="shrink-0 rounded-md border border-rule bg-paper-tint px-3 py-1">
          <ScoreRow player={match.player1} wonSets={wonSets1} />
          <div className="border-t border-rule" />
          <ScoreRow player={match.player2} wonSets={wonSets2} />
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-rule pt-2.5">
        {commentary && <p className="text-muted-label min-w-0 flex-1 truncate text-xs italic">{commentary}</p>}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/h2h/${match.player1.id}/${match.player2.id}`}
            className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1 text-[10px] text-blue-500 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            H2H
          </Link>
          <Link
            href={match.linkHref}
            className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1 text-[10px] text-blue-500 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Draw
          </Link>
        </div>
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
