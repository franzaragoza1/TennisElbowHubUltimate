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
 * lo dice). El propio `app/tournaments/[id]/page.tsx` ya filtra fuera cualquier ronda
 * SIN cruces pendientes (todos sus partidos ya jugados), así que aquí solo llegan
 * rondas de verdad todavía en juego — pedido explícito: no dejar el plazo de una ronda
 * ya completa colgando junto a las de verdad activas.
 *
 * Tabla compacta en vez de la fila de píldoras anterior — `deadlineRows` ya llega
 * ordenada por fecha (más próxima primero) desde la propia consulta.
 */
export function RoundDeadlines({ deadlines }: { deadlines: RoundDeadlineInfo[] }) {
  if (deadlines.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-eyebrow mb-1.5 text-[10px] text-muted-label">Deadlines</p>
      <div className="inline-block overflow-hidden rounded-lg border border-rule bg-paper-tint">
        <table className="border-collapse text-xs">
          <tbody>
            {deadlines.map((d) => (
              <tr key={d.round} className="border-b border-rule last:border-0">
                <th scope="row" className="text-headline px-3 py-1.5 text-left font-normal text-ink">
                  {d.roundLabel}
                </th>
                <td className="tour-numeric text-muted-label px-3 py-1.5 text-right">{formatDeadline(d.deadlineAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
