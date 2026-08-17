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
  /** Presentes solo cuando el ranking en vivo está activo (lib/liveRanking) —
   * `points` de arriba sigue siendo el oficial de partida en ese caso. */
  livePoints?: number;
  pointsDelta?: number;
  currentTournament?: { tournamentName: string; sentence: string } | null;
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

/** Un valor ausente en la columna de puntos delta se pinta sin signo ni color —
 * "sin cambio", no una celda vacía. */
function PointsDelta({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-label">{DASH}</span>;
  return <span className={delta > 0 ? "text-up" : "text-down"}>{delta > 0 ? `+${delta}` : delta}</span>;
}

export function RankingTable({
  rows,
  highlightFinalsCutoff = false,
  isLive = false,
}: {
  rows: RankingRow[];
  /** Solo tiene sentido en la clasificación Race: la Race, no la oficial, es la que
   * decide quién juega las Tour Finals — ver docs/decisiones.md. */
  highlightFinalsCutoff?: boolean;
  /** Cuando está activo, `points` pasa a mostrarse como el oficial de referencia junto
   * a `livePoints`/`pointsDelta`/`currentTournament` — mismo mecanismo en vivo tanto
   * para Oficial (con el toggle activado) como para Race/Next Gen (siempre). */
  isLive?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-label px-3 py-8">No players for this week.</p>;
  }

  // En vivo se enseña siempre junto a un sidebar de 320px (app/rankings/page.tsx) —
  // no hay sitio de sobra para las nueve columnas de siempre. La referencia de ATP
  // tampoco enseña High/W-L/Titles en su vista en vivo (solo Rank/Player/Current
  // Tournament/Live/Official Points/+-), así que aquí se sueltan esas tres en vez de
  // apretar todo lo demás hasta necesitar scroll horizontal — ver docs/decisiones.md.
  const colCount = isLive ? 6 : 7;

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-paper shadow-sm">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-rule bg-paper-tint text-left">
            <th className="text-eyebrow w-12 px-3 py-3 text-xs text-muted-label sm:w-14">
              Rank
            </th>
            <th className={`text-eyebrow px-3 py-3 text-xs text-muted-label ${isLive ? "w-36" : ""}`}>Player</th>
            {isLive && (
              <th className="text-eyebrow hidden w-56 px-3 py-3 text-xs text-muted-label lg:table-cell">
                Current Tournament
              </th>
            )}
            <th className="text-eyebrow hidden w-14 px-3 py-3 text-right text-xs text-muted-label sm:table-cell">
              +/-
            </th>
            {!isLive && (
              <>
                <th className="text-eyebrow hidden w-20 px-3 py-3 text-right text-xs text-muted-label lg:table-cell">
                  High
                </th>
                <th className="text-eyebrow hidden w-24 px-3 py-3 text-right text-xs text-muted-label md:table-cell">
                  W-L
                </th>
                <th className="text-eyebrow hidden w-20 px-3 py-3 text-right text-xs text-muted-label lg:table-cell">
                  Titles
                </th>
              </>
            )}
            {isLive && (
              <th className="text-eyebrow hidden w-16 px-3 py-3 text-right text-xs text-muted-label sm:table-cell">
                Pts +/-
              </th>
            )}
            <th className="text-eyebrow w-24 px-3 py-3 text-right text-xs text-muted-label">
              {isLive ? "Live Points" : "Points"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const qualified = highlightFinalsCutoff && row.rank <= FINALS_CUTOFF;
            return (
              <Fragment key={row.playerId}>
                <tr
                  className={`row-reveal ${isLive ? "h-24" : "h-16"} border-b border-rule transition-colors last:border-0 hover:bg-paper-tint ${
                    qualified ? "border-l-2 border-l-glow-500 bg-glow-500/[0.04]" : ""
                  }`}
                  style={{ "--reveal-delay": `${Math.min(i, 20) * 15}ms` } as React.CSSProperties}
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
                  {isLive && (
                    <td className="hidden px-3 py-2 text-xs lg:table-cell">
                      {row.currentTournament ? (
                        <div className="min-w-0">
                          <p className="text-eyebrow truncate text-[10px] text-muted-label">
                            {row.currentTournament.tournamentName}
                          </p>
                          <p className="text-ink leading-snug">{row.currentTournament.sentence}</p>
                        </div>
                      ) : (
                        <span className="text-muted-label">{DASH}</span>
                      )}
                    </td>
                  )}
                  <td className="hidden px-3 text-right sm:table-cell">
                    <MovedIndicator moved={row.moved} />
                  </td>
                  {!isLive && (
                    <>
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
                    </>
                  )}
                  {isLive && (
                    <td className="tour-numeric hidden px-3 text-right text-xs sm:table-cell">
                      <PointsDelta delta={row.pointsDelta ?? 0} />
                    </td>
                  )}
                  <td className="tour-numeric text-headline px-3 text-right text-ink">
                    {isLive ? (row.livePoints ?? row.points).toLocaleString("en-US") : row.points.toLocaleString("en-US")}
                    {isLive && (
                      <div className="text-muted-label text-[11px] font-normal">
                        {row.points.toLocaleString("en-US")} official
                      </div>
                    )}
                  </td>
                </tr>
                {highlightFinalsCutoff && i === FINALS_CUTOFF - 1 && rows.length > FINALS_CUTOFF && (
                  <tr aria-hidden="true">
                    <td colSpan={colCount} className="p-0">
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
