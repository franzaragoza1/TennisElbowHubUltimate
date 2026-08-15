"use client";

import { useMemo, useState } from "react";
import { buildBracketLayout, fullRoundLadder, roundDisplayLabel, type BracketMatchInput } from "@/lib/bracket";
import { computeWindowGeometry, CARD_WIDTH, COLUMN_GAP, COLUMN_PITCH } from "@/lib/bracketGeometry";
import { MatchCard, type MatchCardData } from "./MatchCard";
import { BracketConnectors } from "./BracketConnectors";
import { RoundChips } from "./RoundChips";

export interface TournamentBracketMatch extends BracketMatchInput, MatchCardData {}

/** Cuántas rondas se enseñan a la vez en la ventana — 2 completas más una pizca de la
 * siguiente asomando (como en la referencia ATP), para que se note que hay más cuadro
 * a la derecha sin tener que enseñarlo entero. */
const VISIBLE_ROUNDS = 2;
const PEEK_WIDTH = 56;

export function BracketColumns({ matches, drawSize }: { matches: TournamentBracketMatch[]; drawSize: number }) {
  const layout = useMemo(() => buildBracketLayout(matches), [matches]);
  const [focusIndex, setFocusIndex] = useState(0);
  // Una ronda extra (la del "asomo") para que su columna exista en la geometría, aunque
  // el contenedor solo deje ver una pizca de ancho de ella.
  const geometry = useMemo(
    () => computeWindowGeometry(layout, focusIndex, VISIBLE_ROUNDS + 1),
    [layout, focusIndex],
  );

  // La escalera COMPLETA del cuadro (no solo las rondas ya decididas) — un torneo a
  // medias necesita saber que Q/S/F existen más adelante para no confundir la última
  // ronda con datos con la Final de verdad (ver el aviso en lib/bracket.ts).
  const ladder = fullRoundLadder(drawSize);
  const labels = layout.roundOrder.map((r) => roundDisplayLabel(ladder, r));
  const lastIndex = Math.max(0, layout.roundOrder.length - 1);
  const windowEnd = Math.min(focusIndex + VISIBLE_ROUNDS - 1, lastIndex);

  function goTo(index: number) {
    setFocusIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  if (layout.roundOrder.length === 0) {
    return <p className="text-muted-label py-8">Este torneo todavía no tiene cuadro.</p>;
  }

  const viewportWidth = VISIBLE_ROUNDS * COLUMN_PITCH - COLUMN_GAP + PEEK_WIDTH;

  return (
    <div>
      <div className="flex items-center gap-2">
        <RoundChips labels={labels} activeIndex={focusIndex} onSelect={goTo} />
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => goTo(focusIndex - 1)}
            disabled={focusIndex === 0}
            aria-label="Previous round"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-muted-label transition-colors hover:border-navy-900 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => goTo(focusIndex + 1)}
            disabled={windowEnd >= lastIndex}
            aria-label="Next round"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-muted-label transition-colors hover:border-navy-900 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>

      {/* La geometría ya viene recalculada en local solo para esta ventana (ver
       * lib/bracketGeometry.ts::computeWindowGeometry) — la altura del contenedor es
       * exactamente la que hace falta, sin trasladar ni recortar un lienzo compartido
       * con el cuadro entero. */}
      <div className="mt-4 overflow-hidden" style={{ width: viewportWidth, maxWidth: "100%", height: geometry.height }}>
        <div className="relative" style={{ width: geometry.width, height: geometry.height }}>
          <BracketConnectors connectors={geometry.connectors} width={geometry.width} height={geometry.height} />
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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
