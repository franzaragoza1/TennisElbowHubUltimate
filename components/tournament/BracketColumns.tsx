"use client";

import { useMemo, useRef, useState } from "react";
import { buildBracketLayout, roundDisplayLabel, type BracketMatchInput } from "@/lib/bracket";
import { computeBracketGeometry, CARD_WIDTH, COLUMN_PITCH } from "@/lib/bracketGeometry";
import { MatchCard, type MatchCardData } from "./MatchCard";
import { BracketConnectors } from "./BracketConnectors";
import { RoundChips } from "./RoundChips";

export interface TournamentBracketMatch extends BracketMatchInput, MatchCardData {}

export function BracketColumns({ matches }: { matches: TournamentBracketMatch[] }) {
  const layout = useMemo(() => buildBracketLayout(matches), [matches]);
  const geometry = useMemo(() => computeBracketGeometry(layout), [layout]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const labels = layout.roundOrder.map((r) => roundDisplayLabel(layout.roundOrder, r));

  function scrollToRound(index: number) {
    setActiveIndex(index);
    const container = scrollRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      left: index * COLUMN_PITCH,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  if (layout.roundOrder.length === 0) {
    return <p className="text-muted-label py-8">Este torneo todavía no tiene cuadro.</p>;
  }

  return (
    <div>
      <RoundChips labels={labels} activeIndex={activeIndex} onSelect={scrollToRound} />

      <div ref={scrollRef} className="mt-4 overflow-x-auto">
        <div
          className="relative"
          style={{ width: geometry.width, height: geometry.height, minWidth: "100%" }}
        >
          <BracketConnectors
            connectors={geometry.connectors}
            width={geometry.width}
            height={geometry.height}
          />
          {geometry.cards.map(({ match, x, y }) => (
            <div key={match.id} className="absolute" style={{ left: x, top: y, width: CARD_WIDTH }}>
              <MatchCard data={match} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
