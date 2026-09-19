import Link from "next/link";

function formatDeadlineUtc(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
}

/**
 * Invitación a `/predict` en la propia ficha de torneo — antes era un simple pill link
 * ("Predict this bracket →") sin ningún contexto, pedido explícito de reemplazarlo por
 * algo más rico: qué es, cuándo cierra y cuánta gente ya ha picado, todo antes de saltar
 * de página (2026-09-18). El estado bloqueado cambia el texto en vez de desaparecer —
 * la invitación sigue teniendo sentido para ver la clasificación una vez cerrado.
 */
export function PredictionPromoCard({
  editionId,
  locked,
  deadlineAt,
  entryCount,
}: {
  editionId: number;
  locked: boolean;
  deadlineAt: string | null;
  entryCount: number;
}) {
  return (
    <div className="hover-lift mb-6 flex flex-col items-start gap-5 rounded-lg bg-navy-900 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="text-3xl" aria-hidden="true">
          🎯
        </span>
        <div>
          <h2 className="text-headline text-lg text-white">Bracket Challenge</h2>
          <p className="mt-1 max-w-md text-sm text-white/70">
            {locked
              ? "Picks are locked — see how everyone's bracket is playing out."
              : "Pick a winner for every round before the draw locks."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {!locked && deadlineAt && <span className="text-eyebrow text-xs text-accent-500">Locks {formatDeadlineUtc(deadlineAt)}</span>}
            {entryCount > 0 && (
              <span className="tour-numeric text-xs text-white/60">
                {entryCount} {entryCount === 1 ? "prediction" : "predictions"} submitted
              </span>
            )}
          </div>
        </div>
      </div>
      <Link
        href={`/tournaments/${editionId}/predict`}
        className="tap-scale text-eyebrow inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-500 px-5 py-2.5 text-xs text-navy-900 hover:bg-accent-500/90"
      >
        {locked ? "View the leaderboard →" : "Make your picks →"}
      </Link>
    </div>
  );
}
