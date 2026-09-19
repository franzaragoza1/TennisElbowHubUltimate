import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import type { RegistrationQueueRow } from "@/lib/tournamentBracketData";

const DASH = "—";

/**
 * "Users in Registration Queue" en la ficha del propio torneo — solo se renderiza
 * cuando `getRegistrationQueueForEdition` trae filas de verdad (pedido explícito del
 * propietario, 2026-09-18); un torneo recién creado con `Queue: 0/N` nunca llega aquí
 * (ver el comentario de esa función), así que este componente no necesita comprobar
 * nada de eso por su cuenta.
 */
export function RegistrationQueueTable({ rows }: { rows: RegistrationQueueRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-paper shadow-sm">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-rule bg-paper-tint text-left">
            <th className="text-eyebrow w-12 px-3 py-3 text-xs text-muted-label sm:w-14">#</th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Player</th>
            <th className="text-eyebrow w-20 px-3 py-3 text-right text-xs text-muted-label">Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            // Un jugador nuevo de verdad (sin `player_aliases` todavía) nunca crea una
            // ficha por el mero hecho de apuntarse a la cola — ver el comentario de la
            // tabla en db/schema.ts. La bandera sale de `location` en ese caso
            // (PlayerAvatar/CountryFlag ya resuelven texto libre por su cuenta).
            const content = (
              <div className="flex min-w-0 items-center gap-3">
                <PlayerAvatar displayName={row.displayName} country={row.country ?? row.location} avatarUrl={row.avatarUrl} />
                <span className="min-w-0 truncate">
                  <span className="text-headline text-ink">{row.displayName}</span>
                  {row.playerId === null && <span className="text-eyebrow ml-2 text-[10px] text-muted-label">(New Player)</span>}
                </span>
              </div>
            );
            return (
              <tr key={row.playerId ?? `${row.displayName}-${i}`} className="row-reveal h-16 border-b border-rule transition-colors last:border-0 hover:bg-paper-tint" style={{ "--reveal-delay": `${Math.min(i, 20) * 15}ms` } as React.CSSProperties}>
                <td className="tour-numeric px-3 text-muted-label">{i + 1}</td>
                <td className="px-3">
                  {row.playerId !== null ? (
                    <Link href={`/players/${row.playerId}`} prefetch={false} className="hover:underline">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </td>
                <td className="tour-numeric px-3 text-right text-ink">{row.rank !== null ? `#${row.rank}` : DASH}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
