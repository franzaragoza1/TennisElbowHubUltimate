import Link from "next/link";

export interface H2HMatchRow {
  matchId: number;
  editionId: number;
  year: number;
  isoWeek: number | null;
  eventName: string;
  round: string;
  winnerName: string;
  loserName: string;
  scoreRaw: string | null;
}

export function H2HMatchHistory({ rows }: { rows: H2HMatchRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8">
        These two have never met on the tour.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-rule bg-paper-tint text-left">
            <th className="text-eyebrow w-20 truncate px-3 py-3 text-xs text-muted-label">
              Date
            </th>
            <th className="text-eyebrow hidden truncate px-3 py-3 text-xs text-muted-label md:table-cell">
              Tournament
            </th>
            <th className="text-eyebrow hidden w-16 truncate px-3 py-3 text-xs text-muted-label md:table-cell">
              Rd
            </th>
            <th className="text-eyebrow truncate px-3 py-3 text-xs text-muted-label">Winner</th>
            <th className="text-eyebrow hidden w-32 truncate px-3 py-3 text-right text-xs text-muted-label sm:table-cell">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.matchId} className="h-14 border-b border-rule last:border-0">
              <td className="tour-numeric text-muted-label px-3 text-xs">
                {row.year}
                {row.isoWeek ? `-W${row.isoWeek}` : ""}
              </td>
              <td className="hidden truncate px-3 md:table-cell">
                <Link
                  href={`/tournaments/${row.editionId}`}
                  className="text-navy-900 hover:underline"
                >
                  {row.eventName}
                </Link>
              </td>
              <td className="text-eyebrow hidden px-3 text-xs text-navy-900 md:table-cell">
                {row.round}
              </td>
              <td className="truncate px-3 text-navy-900">
                <span className="text-headline">{row.winnerName}</span>
                <span className="text-muted-label"> d. {row.loserName}</span>
              </td>
              <td className="tour-numeric hidden px-3 text-right text-navy-900 sm:table-cell">
                {row.scoreRaw ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
