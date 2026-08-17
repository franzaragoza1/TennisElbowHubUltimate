"use client";

import { useState } from "react";
import { forceWinMatch, saveMatchResult } from "@/app/admin/finals/actions";
import type { FinalsFormat } from "@/lib/finals/format";

export interface MatchResultFormPlayer {
  id: number;
  displayName: string;
}

export interface MatchResultFormSet {
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

function setToText(s: MatchResultFormSet): string {
  return `${s.winnerGames}-${s.loserGames}${s.tiebreakLoserPoints !== null ? `(${s.tiebreakLoserPoints})` : ""}`;
}

/**
 * Sirve para dos casos: un cruce todavía `scheduled` (formulario abierto de
 * entrada, como siempre) y uno YA decidido que se quiere corregir — pedido
 * explícito ("Admin must be able to Edit... Tour finals tournaments"). El único
 * sitio con permiso para tocar un partido ya jugado antes de esto era "Force win",
 * y solo para retiradas; esto es una corrección real de marcador.
 *
 * `writeMatchResult` (app/admin/finals/actions.ts) ya borra+reinserta los sets y
 * vuelve a encadenar el avance a eliminatoria / propagación de la Final en cada
 * envío, decidido o no — no hace falta nada nuevo en el backend, solo dejar que el
 * formulario se reenvíe sobre un partido ya jugado.
 */
export function MatchResultForm({
  matchId,
  label,
  player1,
  player2,
  format,
  initialWinnerId,
  initialSets,
}: {
  matchId: number;
  label: string;
  player1: MatchResultFormPlayer;
  player2: MatchResultFormPlayer;
  format: FinalsFormat;
  /** Presente = este cruce ya tiene un resultado — el formulario arranca plegado
   * detrás de un resumen, en vez de abierto de par en par como uno por jugar. */
  initialWinnerId?: number;
  initialSets?: MatchResultFormSet[];
}) {
  const isDecided = initialWinnerId !== undefined;
  const [expanded, setExpanded] = useState(!isDecided);
  const [setCount, setSetCount] = useState(Math.max(initialSets?.length ?? 0, format.setsToWin));

  if (isDecided && !expanded) {
    const winnerName = initialWinnerId === player1.id ? player1.displayName : player2.displayName;
    const scoreText = initialSets?.map(setToText).join(" ") ?? "";
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-paper p-4">
        <div className="min-w-0">
          <p className="text-eyebrow text-xs text-muted-label">{label}</p>
          <p className="text-ink truncate text-sm">
            <span className="text-headline">{winnerName}</span> won {scoreText}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form className="rounded-lg border border-rule bg-paper p-4">
      <input type="hidden" name="matchId" value={matchId} />
      <div className="mb-1 flex items-center justify-between">
        <p className="text-eyebrow text-xs text-muted-label">{label}</p>
        {isDecided && (
          <button type="button" onClick={() => setExpanded(false)} className="text-eyebrow text-xs text-muted-label hover:text-ink">
            Cancel
          </button>
        )}
      </div>
      <p className="text-muted-label mb-3 text-[11px]">
        {format.label} — best of {format.setsToWin * 2 - 1}, first to {format.setsToWin} sets
        {isDecided && " — resubmitting overwrites the current result"}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="winnerId" value={player1.id} required defaultChecked={initialWinnerId === player1.id} className="accent-ink" />
          {player1.displayName}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="winnerId" value={player2.id} defaultChecked={initialWinnerId === player2.id} className="accent-ink" />
          {player2.displayName}
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: setCount }).map((_, i) => (
          <input
            key={i}
            name="set"
            defaultValue={initialSets?.[i] ? setToText(initialSets[i]) : ""}
            placeholder={format.scoreHint}
            className="w-20 rounded border border-rule px-2 py-1 text-center text-sm text-ink"
          />
        ))}
        <button type="button" onClick={() => setSetCount((n) => n + 1)} className="text-eyebrow text-xs text-blue-500 hover:underline">
          + set
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          formAction={saveMatchResult}
          type="submit"
          className="text-eyebrow rounded-full bg-navy-900 px-4 py-1.5 text-xs text-white hover:bg-navy-800"
        >
          Save result
        </button>
        <button
          formAction={forceWinMatch}
          type="submit"
          className="text-eyebrow rounded-full border border-down px-4 py-1.5 text-xs text-down hover:bg-down/10"
        >
          Force win (retired)
        </button>
      </div>
    </form>
  );
}
