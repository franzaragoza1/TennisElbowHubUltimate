"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { matchKey, useLiveScores } from "@/lib/liveTennis/useLiveScores";
import { completedSetWinners } from "@/lib/liveTennis/liveSetWinners";
import type { LiveMatchPlayer } from "@/lib/liveTennis/resolveAgainstOngoing";
import type { LiveTourMatchWithPrediction } from "@/lib/predictor/liveModel";

function PlayerIdentity({ player, isServing }: { player: LiveMatchPlayer; isServing: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1.5">
      <span className="h-5 w-7 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <span className="tour-numeric text-muted-label w-4 shrink-0 text-center text-sm">{player.seed ?? ""}</span>
      <Link href={`/players/${player.id}`} prefetch={false} className="text-ink min-w-0 flex-1 truncate text-base hover:underline">
        {player.displayName}
      </Link>
      {/* De live-tennis.cn (lib/liveTennis/parseLivePage.ts), no de nuestro propio
       * ranking — es la fuente que sí tiene señal real de en vivo (ver el comentario de
       * blendHoldRatesWithElo, lib/predictor/liveModel.ts). Ausente en vez de "elo: —"
       * cuando la fuente no traía uno para este jugador — nunca inventado. */}
      {player.elo !== null && <span className="tour-numeric text-muted-label shrink-0 text-[10px]">elo {player.elo}</span>}
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

/** Win% en vivo (lib/predictor/liveModel.ts) — barra compacta, dos tonos ya usados en
 * el resto de esta tarjeta (azul de enlace, navy de los botones), sin el lila/lima
 * reservado a superficies oscuras (CLAUDE.md §6) que aquí desentonaría sobre `bg-paper`. */
function LiveWinBar({ pct1 }: { pct1: number }) {
  const p1 = Math.round(pct1 * 100);
  const p2 = 100 - p1;
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="tour-numeric w-8 shrink-0 text-right text-[10px] text-muted-label">{p1}%</span>
      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
        <div className="h-full bg-blue-500" style={{ width: `${p1}%` }} />
        <div className="h-full bg-navy-900" style={{ width: `${p2}%` }} />
      </div>
      <span className="tour-numeric w-8 shrink-0 text-[10px] text-muted-label">{p2}%</span>
    </div>
  );
}

function LiveMatchCard({ match, commentary }: { match: LiveTourMatchWithPrediction; commentary: string | null }) {
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
      <LiveWinBar pct1={match.winProbability.player1} />

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
          {/* Sin prefetch en los dos enlaces — ver el comentario en
           * components/tournament/MatchCard.tsx (pase de rendimiento, 2026-09-14).
           * Esta tira además vuelve a renderizarse sola cada 60s (useLiveScores), así
           * que cualquier prefetch aquí se repetiría solo, sin que nadie navegue nunca. */}
          <Link
            href={`/h2h/${match.player1.id}/${match.player2.id}`}
            prefetch={false}
            className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1 text-[10px] text-blue-500 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            H2H
          </Link>
          <Link
            href={match.linkHref}
            prefetch={false}
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
