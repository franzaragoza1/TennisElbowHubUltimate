"use client";

import { useState } from "react";
import { PredictionBracket } from "./PredictionBracket";
import { DUMMY_BRACKET_MATCHES, DUMMY_BRACKET_DRAW_SIZE, DUMMY_LIVE_KEYS } from "@/lib/predictions/dummyPreview";
import type { TournamentBracketMatch } from "./BracketColumns";
import type { BracketPick } from "@/lib/predictions/scoring";

/**
 * Envoltorio delgado alrededor de `PredictionBracket` que añade un interruptor de
 * "cuadro ficticio" — solo se renderiza el interruptor cuando `canPreview` es `true`
 * (calculado en el servidor por `canUseDevPreview()`, ver su comentario: `next dev` +
 * esta cuenta de Discord en concreto, nunca en producción). Con el interruptor apagado
 * se comporta exactamente como antes (los props reales, sin tocar nada).
 */
export function PredictionBracketDevWrapper({
  canPreview,
  matches,
  drawSize,
  editionId,
  initialPicks,
  locked,
}: {
  canPreview: boolean;
  matches: TournamentBracketMatch[];
  drawSize: number;
  editionId: number;
  initialPicks: BracketPick[] | null;
  locked: boolean;
}) {
  const [dummy, setDummy] = useState(false);

  return (
    <div>
      {canPreview && (
        <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 rounded-full border border-dashed border-accent-500 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-500">
          <input type="checkbox" checked={dummy} onChange={(e) => setDummy(e.target.checked)} className="accent-accent-500" />
          Dev preview: dummy bracket &amp; UI states
        </label>
      )}
      {canPreview && dummy ? (
        <PredictionBracket
          matches={DUMMY_BRACKET_MATCHES}
          drawSize={DUMMY_BRACKET_DRAW_SIZE}
          editionId={-1}
          initialPicks={null}
          locked={false}
          dummyMode
          liveOverride={DUMMY_LIVE_KEYS}
        />
      ) : (
        <PredictionBracket matches={matches} drawSize={drawSize} editionId={editionId} initialPicks={initialPicks} locked={locked} />
      )}
    </div>
  );
}
