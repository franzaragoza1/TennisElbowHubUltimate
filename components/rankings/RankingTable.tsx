import Link from "next/link";
import { PlayerAvatar } from "./PlayerAvatar";
import { MovedIndicator } from "./MovedIndicator";

export interface RankingRow {
  rank: number;
  points: number;
  moved: number;
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  /** Mejor puesto alcanzado en todo el histórico importado (2021+). */
  careerHigh: number | null;
  titles: number;
  yearWins: number;
  yearLosses: number;
}

/** Un valor ausente se pinta con un guion, nunca con una celda vacía (CLAUDE.md §6). */
const DASH = "—";

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-label px-3 py-8">No players for this week.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-rule bg-paper-tint text-left">
            <th className="text-eyebrow w-12 px-3 py-3 text-xs text-muted-label sm:w-14">
              Rank
            </th>
            <th className="text-eyebrow px-3 py-3 text-xs text-muted-label">Player</th>
            <th className="text-eyebrow hidden w-16 px-3 py-3 text-right text-xs text-muted-label sm:table-cell">
              +/-
            </th>
            <th className="text-eyebrow hidden w-20 px-3 py-3 text-right text-xs text-muted-label lg:table-cell">
              High
            </th>
            <th className="text-eyebrow hidden w-24 px-3 py-3 text-right text-xs text-muted-label md:table-cell">
              W-L
            </th>
            <th className="text-eyebrow hidden w-20 px-3 py-3 text-right text-xs text-muted-label lg:table-cell">
              Titles
            </th>
            <th className="text-eyebrow w-24 px-3 py-3 text-right text-xs text-muted-label">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId} className="h-16 border-b border-rule last:border-0">
              <td className="tour-numeric text-headline px-3 text-navy-900">{row.rank}</td>
              <td className="px-3">
                <Link
                  href={`/players/${row.playerId}`}
                  className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <PlayerAvatar
                    displayName={row.displayName}
                    country={row.country}
                    character={row.character}
                  />
                  <span className="text-headline truncate text-navy-900 hover:underline">
                    {row.displayName}
                  </span>
                </Link>
              </td>
              <td className="hidden px-3 text-right sm:table-cell">
                <MovedIndicator moved={row.moved} />
              </td>
              <td className="tour-numeric hidden px-3 text-right text-muted-label lg:table-cell">
                {row.careerHigh === null ? DASH : `#${row.careerHigh}`}
              </td>
              <td className="tour-numeric hidden px-3 text-right text-navy-900 md:table-cell">
                {row.yearWins === 0 && row.yearLosses === 0
                  ? DASH
                  : `${row.yearWins}-${row.yearLosses}`}
              </td>
              <td className="tour-numeric hidden px-3 text-right text-navy-900 lg:table-cell">
                {row.titles === 0 ? DASH : row.titles}
              </td>
              <td className="tour-numeric text-headline px-3 text-right text-navy-900">
                {row.points.toLocaleString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
