export interface RoundDeadlineInfo {
  round: string;
  roundLabel: string;
  deadlineAt: string;
}

function formatDeadline(iso: string): string {
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
 * Solo existe mientras el torneo sigue en juego — Mana deja de publicar el plazo en
 * cuanto termina (ver lib/mana/loadTournament.ts y docs/decisiones.md 2026-09-05), así
 * que `deadlines` viene vacío para cualquier torneo ya completado y este componente no
 * pinta nada (nunca hace falta comprobar "¿está en juego?" aparte, el propio dato ya
 * lo dice).
 */
export function RoundDeadlines({ deadlines }: { deadlines: RoundDeadlineInfo[] }) {
  if (deadlines.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {deadlines.map((d) => (
        <span
          key={d.round}
          className="text-eyebrow rounded-full border border-rule bg-paper-tint px-3 py-1.5 text-[11px] text-muted-label"
        >
          <span className="text-headline text-ink">{d.roundLabel}</span> deadline: {formatDeadline(d.deadlineAt)}
        </span>
      ))}
    </div>
  );
}
