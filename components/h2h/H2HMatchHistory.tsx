import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import type { H2HPlayerInfo } from "./H2HHeader";

export interface H2HMatchRow {
  matchId: number;
  /** /tournaments/[id] para el tour principal, /finals/[id] para las Tour Finals. */
  href: string;
  year: number;
  isoWeek: number | null;
  eventName: string;
  round: string;
  /** Ganó el jugador 1 de la página (el de la izquierda en la cabecera), no el
   * "player1" interno de la fila de `matches` — para que cada fila se lea siempre con
   * los mismos dos jugadores en el mismo lado, azul a la izquierda y lima a la
   * derecha, en vez de "Ganador venció a Perdedor" reordenados fila a fila. */
  player1Won: boolean;
  scoreRaw: string | null;
}

/**
 * Cada fila enseña siempre a los MISMOS dos jugadores en el mismo sitio (azul =
 * jugador 1 de la cabecera, lima = jugador 2), con el nombre del que ganó ESE cruce en
 * negrita y coloreado — así se lee de un vistazo quién dominó sin tener que leer cada
 * fila entera. Tema oscuro a propósito: vive justo debajo de la cabecera (pedido
 * explícito, "right under the two players"), rodeada de otras secciones oscuras.
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
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <div className="divide-y divide-white/10">
        {rows.map((row) => (
          <div key={row.matchId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="tour-numeric w-20 shrink-0 text-xs text-white/50">
              {row.year}
              {row.isoWeek ? `-W${row.isoWeek}` : ""}
            </div>

            <div className="min-w-0 sm:w-48 sm:shrink-0">
              <Link href={row.href} className="block truncate text-sm text-white hover:underline">
                {row.eventName}
              </Link>
              <p className="text-eyebrow text-[10px] text-white/40">{row.round}</p>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
              <span
                className={`flex min-w-0 flex-1 items-center justify-end gap-2 truncate text-sm ${
                  row.player1Won ? "text-headline text-blue-500" : "text-white/50"
                }`}
              >
                <span className="truncate">{player1.displayName}</span>
                <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-white/10">
                  <CountryFlag country={player1.country} className="h-full w-full object-cover" />
                </span>
              </span>

              <span className="tour-numeric shrink-0 text-sm text-white/70">{row.scoreRaw ?? "—"}</span>

              <span
                className={`flex min-w-0 flex-1 items-center gap-2 truncate text-sm ${
                  !row.player1Won ? "text-headline text-accent-500" : "text-white/50"
                }`}
              >
                <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-white/10">
                  <CountryFlag country={player2.country} className="h-full w-full object-cover" />
                </span>
                <span className="truncate">{player2.displayName}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
