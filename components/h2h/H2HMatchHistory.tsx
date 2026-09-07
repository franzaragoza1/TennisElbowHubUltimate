import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { roundLabel } from "@/lib/roundOrder";
import { surfaceFamily } from "@/lib/surfaceColors";
import type { H2HPlayerInfo } from "./H2HHeader";

export interface H2HMatchRow {
  matchId: number;
  /** /tournaments/[id] para el tour principal, /finals/[id] para las Tour Finals. */
  href: string;
  year: number;
  isoWeek: number | null;
  eventName: string;
  round: string;
  /** `null` en un partido de Finals — esas ediciones no tienen pista real
   * (lib/finals/mirror.ts). Se enseña la FAMILIA (Hard/Clay/Grass/Carpet, ver
   * lib/surfaceColors.ts), nunca el nombre exacto de pista/skin: la columna "Event" ya
   * da el nombre del torneo, repetirlo como "Miami ATP 1000" en la columna de
   * superficie sería ruido, no información nueva. */
  surface: string | null;
  /** Ganó el jugador 1 de la página (el de la izquierda en la cabecera), no el
   * "player1" interno de la fila de `matches` — para que cada fila se lea siempre con
   * los mismos dos jugadores en el mismo lado, azul a la izquierda y lima a la
   * derecha, en vez de "Ganador venció a Perdedor" reordenados fila a fila. */
  player1Won: boolean;
  scoreRaw: string | null;
}

/**
 * Réplica de la tabla "Event Breakdown" de la referencia ATP (pedido explícito:
 * "should look exactly like this") — cabecera Year/Winner/Event/Round/Surface/Score/
 * View details, filas alternadas sobre fondo navy. Único cambio real frente a la
 * referencia: UN solo botón "Results" en vez de "Results"+"Draws" — este sitio solo
 * tiene una página por torneo (el cuadro ya ES el resultado), así que un segundo botón
 * sería un duplicado exacto del primero, no una vista distinta de verdad.
 */
export function H2HMatchHistory({
  rows,
  player1,
  player2,
}: {
  rows: H2HMatchRow[];
  player1: H2HPlayerInfo;
  player2: H2HPlayerInfo;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-8 text-white/50">
        These two have never met on the tour.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-navy-800 text-left">
            <th className="text-eyebrow px-4 py-3 text-[11px] text-white/50">Year</th>
            <th className="text-eyebrow px-4 py-3 text-[11px] text-white/50">Winner</th>
            <th className="text-eyebrow px-4 py-3 text-[11px] text-white/50">Event</th>
            <th className="text-eyebrow px-4 py-3 text-[11px] text-white/50">Round</th>
            <th className="text-eyebrow px-4 py-3 text-[11px] text-white/50">Surface</th>
            <th className="text-eyebrow px-4 py-3 text-[11px] text-white/50">Score</th>
            <th className="text-eyebrow px-4 py-3 text-right text-[11px] text-white/50">View details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const winner = row.player1Won ? player1 : player2;
            return (
              <tr key={row.matchId} className={i % 2 === 0 ? "bg-navy-900" : "bg-navy-800/60"}>
                <td className="tour-numeric px-4 py-3 text-xs whitespace-nowrap text-white/60">{row.year}</td>
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0">
                      {winner.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto remota de Discord o subida propia, no un asset next/image
                        <img src={winner.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-white/15 object-cover" />
                      ) : (
                        <div className="text-eyebrow flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-accent-500 text-[10px] text-navy-900">
                          {winner.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -right-1 -bottom-1 h-3.5 w-5 shrink-0 overflow-hidden rounded-sm border border-navy-900 bg-white/10">
                        <CountryFlag country={winner.country} className="h-full w-full object-cover" />
                      </span>
                    </div>
                    <span className="text-headline truncate text-sm whitespace-nowrap text-white">{winner.displayName}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={row.href} className="whitespace-nowrap text-white/90 hover:text-white hover:underline">
                    {row.eventName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-white/60">{roundLabel(row.round)}</td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-white/60">{surfaceFamily(row.surface) ?? "—"}</td>
                <td className="tour-numeric px-4 py-3 text-xs whitespace-nowrap text-white/70">{row.scoreRaw ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={row.href}
                    className="text-eyebrow inline-block rounded border border-white/25 px-3 py-1.5 text-[10px] whitespace-nowrap text-white hover:border-white/50 hover:bg-white/10"
                  >
                    Results
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
