import { Fragment } from "react";
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

/** Cuántos puestos dan plaza directa a las Tour Finals — el corte que resalta la tabla. */
const FINALS_CUTOFF = 8;

/** Un valor ausente se pinta con un guion, nunca con una celda vacía (CLAUDE.md §6). */
const DASH = "—";

function RankBadge({ rank, qualified }: { rank: number; qualified: boolean }) {
  return (
    <span
      className={`tour-numeric text-headline inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
        qualified ? "bg-glow-500/15 text-glow-500 ring-1 ring-glow-500/50" : "text-ink"
      }`}
    >
      {rank}
    </span>
  );
}

export function RankingTable({
  rows,
  highlightFinalsCutoff = false,
}: {
  rows: RankingRow[];
  /** Solo tiene sentido en la clasificación Race: la Race, no la oficial, es la que
   * decide quién juega las Tour Finals — ver docs/decisiones.md. */
  highlightFinalsCutoff?: boolean;
}) {
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
          {rows.map((row, i) => {
            const qualified = highlightFinalsCutoff && row.rank <= FINALS_CUTOFF;
            return (
              <Fragment key={row.playerId}>
                <tr
                  className={`h-16 border-b border-rule transition-colors last:border-0 hover:bg-paper-tint ${
                    qualified ? "border-l-2 border-l-glow-500 bg-glow-500/[0.04]" : ""
                  }`}
                >
                  <td className="px-3">
                    <RankBadge rank={row.rank} qualified={qualified} />
                  </td>
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
                      <span className="text-headline truncate text-ink hover:underline">
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
                  <td className="tour-numeric hidden px-3 text-right text-ink md:table-cell">
                    {row.yearWins === 0 && row.yearLosses === 0
                      ? DASH
                      : `${row.yearWins}-${row.yearLosses}`}
                  </td>
                  <td className="tour-numeric hidden px-3 text-right text-ink lg:table-cell">
                    {row.titles === 0 ? DASH : row.titles}
                  </td>
                  <td className="tour-numeric text-headline px-3 text-right text-ink">
                    {row.points.toLocaleString("en-US")}
                  </td>
                </tr>
                {highlightFinalsCutoff && i === FINALS_CUTOFF - 1 && rows.length > FINALS_CUTOFF && (
                  <tr aria-hidden="true">
                    <td colSpan={7} className="p-0">
                      <div className="flex items-center gap-3 bg-glow-500/10 px-3 py-1.5">
                        <span className="h-px flex-1 bg-glow-500/40" />
                        <span className="text-eyebrow shrink-0 text-[10px] text-glow-500">
                          Finals cutoff — top {FINALS_CUTOFF} qualify
                        </span>
                        <span className="h-px flex-1 bg-glow-500/40" />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
