"use client";

import { useMemo, useState } from "react";
import type { BracketLayout } from "@/lib/bracket";
import {
  computeWindowGeometry,
  type GeometryDims,
} from "@/lib/bracketGeometry";
import { isPathConnector, matchIdsInvolving } from "@/lib/bracketPath";
import { scoreFromPerspective } from "@/lib/matchScore";
import {
  BYE_PLAYER_ID,
  OUTCOME_LABEL,
  TBD_PLAYER_ID,
  type MatchCardPlayer,
} from "./MatchCard";
import { BracketConnectors } from "./BracketConnectors";
import type { TournamentBracketMatch } from "./BracketColumns";

const ROW_H = 22;
const CARD_W = 148;
const DIMS: GeometryDims = {
  cardHeight: ROW_H * 2 + 1,
  slotHeight: ROW_H * 2 + 1 + 8,
  columnGap: 16,
};
const HEADER_H = 22;
/** Por debajo de esta escala el texto deja de leerse aunque se haga zoom con los dedos —
 * un cuadro más ancho que esto se desplaza en horizontal en vez de encogerse más. */
const MIN_SCALE = 0.65;

function PlayerRow({
  player,
  isWinner,
  scores,
  outcomeLabel,
  selected,
  onSelect,
}: {
  player: MatchCardPlayer;
  isWinner: boolean;
  scores: { games: number }[];
  outcomeLabel: string | null;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const isPlaceholder =
    player.id === BYE_PLAYER_ID || player.id === TBD_PLAYER_ID;
  const nameClass = `min-w-0 flex-1 truncate text-left text-[11px] leading-none ${
    isWinner ? "text-headline text-glow-500" : "text-ink"
  } ${selected ? "underline" : ""}`;

  return (
    <div
      style={{ height: ROW_H }}
      className={`flex items-center gap-1 px-1.5 ${isWinner ? "bg-glow-500/10" : ""}`}
    >
      <span className="tour-numeric text-muted-label w-3 shrink-0 text-center text-[9px]">
        {!isPlaceholder && player.seed ? player.seed : ""}
      </span>
      {isPlaceholder ? (
        <span className="text-muted-label min-w-0 flex-1 text-[11px] italic leading-none">
          {player.id === BYE_PLAYER_ID ? "Bye" : "TBD"}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(player.id)}
          aria-pressed={selected}
          title={player.displayName}
          className={`${nameClass} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500`}
        >
          {player.displayName}
        </button>
      )}
      <span className="tour-numeric text-muted-label flex shrink-0 items-center gap-1 text-[10px]">
        {scores.map((s, i) => (
          <span key={i} className="w-2.5 text-center">
            {s.games}
          </span>
        ))}
        {outcomeLabel && (
          <span className="text-eyebrow text-[8px]">{outcomeLabel}</span>
        )}
      </span>
    </div>
  );
}

export function CompactBracket({
  layout,
  labels,
  liveMatchIds,
  availableWidth,
}: {
  layout: BracketLayout<TournamentBracketMatch>;
  labels: string[];
  liveMatchIds: Set<number>;
  availableWidth: number | null;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const widthByRound = useMemo(
    () => new Map(layout.roundOrder.map((r) => [r, CARD_W])),
    [layout.roundOrder],
  );
  const geometry = useMemo(
    () =>
      computeWindowGeometry(
        layout,
        0,
        layout.roundOrder.length,
        widthByRound,
        DIMS,
      ),
    [layout, widthByRound],
  );

  const involved = useMemo(
    () =>
      matchIdsInvolving(
        geometry.cards.map((c) => c.match),
        selectedId,
      ),
    [geometry.cards, selectedId],
  );
  const connectors = useMemo(
    () =>
      geometry.connectors
        .map((c) => ({ ...c, highlighted: isPathConnector(c, involved) }))
        .sort((a, b) => Number(a.highlighted) - Number(b.highlighted)),
    [geometry.connectors, involved],
  );

  const scale =
    availableWidth === null
      ? 1
      : Math.min(1, Math.max(MIN_SCALE, availableWidth / geometry.width));
  const canvasHeight = geometry.height + HEADER_H;

  function toggle(id: number) {
    setSelectedId((cur) => (cur === id ? null : id));
  }

  return (
    <div>
      <p className="text-muted-label mt-3 text-xs">
        {selectedId === null
          ? "Tap a player to trace their path through the draw."
          : "Tap the player again to clear the path."}
      </p>
      <div
        className="scrollbar-hidden mt-3 overflow-x-auto"
        style={{ maxWidth: "100%" }}
      >
        <div
          style={{
            width: geometry.width * scale,
            height: canvasHeight * scale,
          }}
        >
          <div
            className="relative"
            style={{
              width: geometry.width,
              height: canvasHeight,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {layout.roundOrder.map((round, i) => (
              <span
                key={round}
                className="text-eyebrow text-muted-label absolute text-[10px]"
                style={{
                  left: i * (CARD_W + DIMS.columnGap),
                  top: 0,
                  width: CARD_W,
                }}
              >
                {labels[i]}
              </span>
            ))}
            <div
              className="absolute inset-x-0"
              style={{ top: HEADER_H, height: geometry.height }}
            >
              <BracketConnectors
                connectors={connectors}
                width={geometry.width}
                height={geometry.height}
              />
              {geometry.cards.map(({ match, x, y, width }) => {
                const dimmed = selectedId !== null && !involved.has(match.id);
                const outcomeLabel =
                  match.outcome !== "played"
                    ? OUTCOME_LABEL[match.outcome]
                    : null;
                const p1Won = match.winnerId === match.player1.id;
                const p2Won = match.winnerId === match.player2.id;
                return (
                  <div
                    key={match.id}
                    className={`absolute overflow-hidden rounded border bg-paper transition-opacity duration-150 ${
                      involved.has(match.id) ? "border-blue-500" : "border-rule"
                    } ${dimmed ? "opacity-40" : ""}`}
                    style={{ left: x, top: y, width, height: DIMS.cardHeight }}
                  >
                    {liveMatchIds.has(match.id) && (
                      <span
                        className="bg-down absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full"
                        aria-label="Live"
                      />
                    )}
                    <PlayerRow
                      player={match.player1}
                      isWinner={p1Won}
                      scores={scoreFromPerspective(match.sets, p1Won)}
                      outcomeLabel={outcomeLabel}
                      selected={selectedId === match.player1.id}
                      onSelect={toggle}
                    />
                    <div className="border-t border-rule" />
                    <PlayerRow
                      player={match.player2}
                      isWinner={p2Won}
                      scores={scoreFromPerspective(match.sets, p2Won)}
                      outcomeLabel={null}
                      selected={selectedId === match.player2.id}
                      onSelect={toggle}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
