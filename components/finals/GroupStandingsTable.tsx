import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import type { QualStatus } from "@/lib/finals/qualification";

export interface StandingsRow {
  playerId: number;
  displayName: string;
  country: string | null;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  /** null solo si el grupo todavía no ha arrancado. En juego, viene del cálculo
   * "score-bound" (`computeQualificationStatus`); una vez completo, 1º y 2º de la
   * tabla ya ordenada = clasificados a semis, el resto eliminados — se mantiene
   * marcado, no se apaga, porque es justo la marca que dice de un vistazo quién pasó. */
  qualStatus: QualStatus | null;
}

const BADGE: Record<QualStatus, { label: string; className: string } | null> = {
  qualified: { label: "Q", className: "bg-up/15 text-up" },
  eliminated: { label: "E", className: "bg-down/15 text-down" },
  pending: null,
};

const ROW_ACCENT: Record<QualStatus, string> = {
  qualified: "border-l-2 border-l-up",
  eliminated: "border-l-2 border-l-down",
  pending: "border-l-2 border-l-transparent",
};

export function GroupStandingsTable({ groupLabel, rows }: { groupLabel: string; rows: StandingsRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
      <div className="border-b border-rule bg-paper-tint px-4 py-2.5">
        <p className="text-eyebrow text-xs text-muted-label">Group {groupLabel}</p>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="w-8 px-3 py-2"></th>
            <th className="w-8 px-1 py-2"></th>
            <th className="text-eyebrow px-3 py-2 text-xs text-muted-label">Player</th>
            <th className="text-eyebrow w-14 px-3 py-2 text-right text-xs text-muted-label">W-L</th>
            <th className="text-eyebrow hidden w-16 px-3 py-2 text-right text-xs text-muted-label sm:table-cell">
              Sets
            </th>
            <th className="text-eyebrow hidden w-16 px-3 py-2 text-right text-xs text-muted-label sm:table-cell">
              Games
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const badge = row.qualStatus ? BADGE[row.qualStatus] : null;
            return (
              <tr
                key={row.playerId}
                className={`h-12 border-b border-b-rule last:border-b-0 ${
                  row.qualStatus ? ROW_ACCENT[row.qualStatus] : "border-l-2 border-l-transparent"
                }`}
              >
                <td className="tour-numeric px-3 text-sm text-muted-label">{i + 1}</td>
                <td className="px-1">
                  {badge && (
                    <span className={`text-eyebrow flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </td>
                <td className="px-3">
                  <Link
                    href={`/players/${row.playerId}`}
                    className="flex min-w-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                      <CountryFlag country={row.country} className="h-full w-full object-cover" />
                    </span>
                    <span className="text-headline truncate text-sm text-ink hover:underline">{row.displayName}</span>
                    <span className="text-muted-label shrink-0 text-xs">({row.seed})</span>
                  </Link>
                </td>
                <td className="tour-numeric px-3 text-right text-sm text-ink">
                  {row.wins}-{row.losses}
                </td>
                <td className="tour-numeric hidden px-3 text-right text-sm text-ink sm:table-cell">
                  {row.setsWon}-{row.setsLost}
                </td>
                <td className="tour-numeric hidden px-3 text-right text-sm text-ink sm:table-cell">
                  {row.gamesWon}-{row.gamesLost}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
