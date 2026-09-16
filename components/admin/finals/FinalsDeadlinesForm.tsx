"use client";

import { useState, useTransition } from "react";
import { setFinalsRoundDeadline, type FinalsDeadlineRound } from "@/app/admin/finals/actions";

const ROUND_LABEL: Record<FinalsDeadlineRound, string> = {
  RR: "Round robin",
  S: "Semifinals",
  F: "Final",
};

/** `deadlineAt.toISOString()` recortado a los primeros 16 caracteres ("YYYY-MM-
 * DDTHH:mm") es exactamente el formato que espera un `<input type="datetime-local">`
 * — y como `toISOString()` siempre da hora UTC, esto puebla el campo en UTC sin
 * conversión de por medio. Al revés, un valor de vuelta sin sufijo de zona más "Z" lo
 * interpreta `Date` como UTC otra vez — mismo criterio que ya usa `RoundDeadlines.tsx`
 * al pintar el plazo siempre en UTC, nunca en la zona horaria de quien mira la
 * pantalla (un admin y los jugadores pueden estar en zonas distintas). */
function toInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

function DeadlineRow({
  finalsEditionId,
  round,
  initialValue,
  onSaved,
}: {
  finalsEditionId: number;
  round: FinalsDeadlineRound;
  initialValue: string | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(toInputValue(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const { error } = await setFinalsRoundDeadline(finalsEditionId, round, value === "" ? null : `${value}Z`);
      if (error) {
        setError(error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper px-3 py-2">
      <span className="text-eyebrow w-28 shrink-0 text-xs text-muted-label">{ROUND_LABEL[round]}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-rule px-2 py-1 text-sm text-ink"
      />
      <span className="text-eyebrow text-[10px] text-muted-label">UTC</span>
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="text-eyebrow rounded-full border border-rule px-3 py-1.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {value !== "" && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            startTransition(async () => {
              const { error } = await setFinalsRoundDeadline(finalsEditionId, round, null);
              if (error) setError(error);
              else onSaved();
            });
          }}
          disabled={isPending}
          className="text-eyebrow text-xs text-down hover:underline disabled:opacity-50"
        >
          Clear
        </button>
      )}
      {error && <p className="text-down w-full text-xs">{error}</p>}
    </div>
  );
}

/** Un plazo por fase, no por partido ni por grupo — pedido explícito (2026-09-17):
 * "Only for ALL Round robin, semifinals and final". Solo tiene sentido una vez existe
 * la ficha pública (`mirroredEditionId`, ver `FinalsSection.tsx`): antes de arrancar
 * la fase de grupos no hay dónde enganchar el plazo. */
export function FinalsDeadlinesForm({
  finalsEditionId,
  deadlines,
  onSaved,
}: {
  finalsEditionId: number;
  deadlines: Record<FinalsDeadlineRound, string | null>;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-2">
      {(["RR", "S", "F"] as const).map((round) => (
        <DeadlineRow key={round} finalsEditionId={finalsEditionId} round={round} initialValue={deadlines[round]} onSaved={onSaved} />
      ))}
    </div>
  );
}
