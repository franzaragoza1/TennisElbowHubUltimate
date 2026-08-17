import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { surfaceColor } from "@/lib/surfaceColors";
import { roundLabel } from "@/lib/roundOrder";
import type { PairedSetScore } from "@/lib/matchScore";

export interface RecentActivityMatch {
  /** Negativo para un bye (`-byes.id`) — nunca puede chocar con un `matches.id` real
   * (siempre positivo, `serial`), así que sirve igual de bien como key de React. */
  matchId: number;
  round: string;
  /** `null` en un bye: no hay rival, no hubo partido. */
  opponentId: number | null;
  opponentName: string | null;
  opponentCountry: string | null;
  opponentSeed: number | null;
  result: "W" | "L";
  outcome: "played" | "walkover" | "retired" | "disqualified" | "random" | "bye";
  scores: PairedSetScore[];
  youtubeVideoId: string | null;
}

export interface TournamentActivityGroup {
  editionId: number;
  eventName: string;
  category: string;
  surface: string | null;
  weekStartDate: string | null;
  matches: RecentActivityMatch[];
}

const OUTCOME_LABEL: Record<Exclude<RecentActivityMatch["outcome"], "played" | "bye">, string> = {
  walkover: "w.o.",
  retired: "ret.",
  disqualified: "DISQ",
  random: "RL",
};

/**
 * Resumen honesto del paso por el torneo, solo cuando el último partido registrado lo
 * deja claro: perdió (se acabó ahí, sea la ronda que sea) o ganó la Final (campeón).
 * Si el último partido registrado es una VICTORIA en una ronda que no es la Final, no
 * sabemos si el torneo sigue en curso o si el límite de partidos recientes cortó la
 * lista a media altura — mejor no decir nada que insinuar algo que no consta. Un bye
 * nunca es la Final (nunca hay bye en la última ronda), así que un bye al final de la
 * lista no puede ser el resumen — se ignora y se mira el último partido de verdad.
 */
export function tournamentSummary(matches: RecentActivityMatch[]): string | null {
  const real = matches.filter((m) => m.outcome !== "bye");
  const last = real[real.length - 1];
  if (!last) return null;
  if (last.result === "L") return last.round === "F" ? "Runner-up" : `Lost in ${roundLabel(last.round)}`;
  if (last.result === "W" && last.round === "F") return "Champion";
  return null;
}

function formatWeekStart(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Cada set enseña los dos marcadores pegados ("6" + "7" con el superíndice sobre el
 * que perdió el partido), como en la referencia ATP — no solo el número propio: sin el
 * rival al lado no se distingue "gané 6-0" de "gané 7-6". */
function ScoreCell({ scores, outcome }: { scores: PairedSetScore[]; outcome: Exclude<RecentActivityMatch["outcome"], "bye"> }) {
  const outcomeLabel = outcome !== "played" ? OUTCOME_LABEL[outcome] : null;
  return (
    <span className="tour-numeric inline-flex items-center gap-2">
      {scores.map((s, i) => (
        <span key={i} className="inline-flex text-ink">
          <span className="relative">
            {s.playerGames}
            {s.playerSuperscript !== null && (
              <sup className="absolute -right-1.5 top-0 text-[9px]">{s.playerSuperscript}</sup>
            )}
          </span>
          <span className="relative">
            {s.opponentGames}
            {s.opponentSuperscript !== null && (
              <sup className="absolute -right-1.5 top-0 text-[9px]">{s.opponentSuperscript}</sup>
            )}
          </span>
        </span>
      ))}
      {outcomeLabel && <span className="text-eyebrow text-[10px] text-muted-label">{outcomeLabel}</span>}
    </span>
  );
}

function ResultIcon({ result }: { result: "W" | "L" }) {
  const isWin = result === "W";
  return (
    <svg
      aria-label={isWin ? "Won" : "Lost"}
      viewBox="0 0 20 20"
      width="14"
      height="14"
      className={isWin ? "text-up" : "text-down"}
    >
      {isWin ? (
        <path
          fill="currentColor"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M5.6 4.2 10 8.6l4.4-4.4 1.4 1.4L11.4 10l4.4 4.4-1.4 1.4L10 11.4l-4.4 4.4-1.4-1.4L8.6 10 4.2 5.6Z"
        />
      )}
    </svg>
  );
}

function TournamentGroup({ group }: { group: TournamentActivityGroup }) {
  const dateLabel = formatWeekStart(group.weekStartDate);
  // El resumen (Champion/Runner-up/Lost in X) se calcula sobre el orden cronológico
  // real (R1 -> F, `group.matches` tal cual llega), pero se enseña de la ronda más
  // avanzada hacia la más temprana — así se lee de un vistazo hasta dónde llegó, en
  // vez de tener que bajar hasta la última fila para saberlo.
  const summary = tournamentSummary(group.matches);
  const displayMatches = [...group.matches].reverse();

  return (
    <div className="hover-lift overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
      <div className="h-1" style={{ backgroundColor: surfaceColor(group.surface) }} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-eyebrow shrink-0 rounded border border-rule px-1.5 py-0.5 text-[10px] text-muted-label">
            {group.category}
          </span>
          <Link
            href={`/tournaments/${group.editionId}`}
            className="text-headline truncate text-ink hover:text-blue-500"
          >
            {group.eventName}
          </Link>
        </div>
        {summary && <span className="text-eyebrow shrink-0 text-[10px] text-muted-label">{summary}</span>}
      </div>
      <p className="text-muted-label px-4 pb-3 text-xs">
        {[dateLabel, group.surface].filter(Boolean).join(" · ")}
      </p>

      <table className="w-full table-fixed border-collapse border-t border-rule">
        <thead>
          <tr className="bg-paper-tint text-left">
            <th className="text-eyebrow w-12 truncate px-4 py-2 text-[10px] text-muted-label">Rd</th>
            <th className="text-eyebrow truncate px-2 py-2 text-[10px] text-muted-label">Opponent</th>
            <th className="text-eyebrow w-28 truncate px-4 py-2 text-right text-[10px] text-muted-label">Score</th>
          </tr>
        </thead>
        <tbody>
          {displayMatches.map((m) =>
            m.outcome === "bye" ? (
              <tr key={m.matchId} className="h-11 border-b border-rule last:border-0">
                <td className="text-eyebrow px-4 text-xs text-ink">{roundLabel(m.round)}</td>
                <td className="px-2">
                  <span className="text-muted-label italic">Bye</span>
                </td>
                <td className="px-4 text-right">
                  <span className="text-muted-label">—</span>
                </td>
              </tr>
            ) : (
              <tr key={m.matchId} className="h-11 border-b border-rule last:border-0">
                <td className="text-eyebrow px-4 text-xs text-ink">{roundLabel(m.round)}</td>
                <td className="px-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ResultIcon result={m.result} />
                    <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
                      <CountryFlag country={m.opponentCountry} className="h-full w-full object-cover" />
                    </span>
                    <Link href={`/players/${m.opponentId}`} className="truncate text-ink hover:underline">
                      {m.opponentName}
                    </Link>
                    {m.opponentSeed && <span className="text-muted-label shrink-0 text-xs">({m.opponentSeed})</span>}
                  </span>
                </td>
                <td className="px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ScoreCell scores={m.scores} outcome={m.outcome} />
                    {m.youtubeVideoId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${m.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Watch match"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-down hover:bg-down/10"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface ActivityStats {
  wins: number;
  losses: number;
  titles: number;
}

/** Franja de resumen — solo Record y Titles, nunca Prize Money: el tour no mueve
 * dinero real (docs/decisiones.md, "Recent activity del jugador") y esta franja hereda
 * ese mismo criterio para el filtro de temporada/nivel. */
function StatStrip({ stats }: { stats: ActivityStats }) {
  return (
    <div className="mb-4 flex items-center gap-8 rounded-lg border border-rule bg-paper px-5 py-3 shadow-sm">
      <div>
        <p className="tour-numeric text-headline text-lg text-ink">
          {stats.wins}-{stats.losses}
        </p>
        <p className="text-eyebrow text-[10px] text-muted-label">W-L</p>
      </div>
      <div>
        <p className="tour-numeric text-headline text-lg text-ink">{stats.titles}</p>
        <p className="text-eyebrow text-[10px] text-muted-label">Titles</p>
      </div>
    </div>
  );
}

export function RecentActivity({
  groups,
  stats,
  emptyMessage = "No matches on record yet.",
}: {
  groups: TournamentActivityGroup[];
  stats?: ActivityStats;
  emptyMessage?: string;
}) {
  if (groups.length === 0) {
    return <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8">{emptyMessage}</p>;
  }

  return (
    <div>
      {stats && <StatStrip stats={stats} />}
      <div className="flex flex-col gap-4">
        {groups.map((g, i) => (
          <div key={g.editionId} className="row-reveal" style={{ "--reveal-delay": `${Math.min(i, 10) * 40}ms` } as React.CSSProperties}>
            <TournamentGroup group={g} />
          </div>
        ))}
      </div>
    </div>
  );
}
