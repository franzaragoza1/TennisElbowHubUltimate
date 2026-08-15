import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { scoreFromPerspective } from "@/lib/matchScore";
import { roundPhrase } from "@/lib/roundPhrase";
import { matchSummary } from "@/lib/scoreFormat";
import type { ScoreMatchRow } from "@/lib/scoresQueries";

const OUTCOME_LABEL: Record<string, string> = {
  walkover: "w.o.",
  retired: "ret.",
  disqualified: "DISQ",
  random: "RL",
};

interface ScorePlayer {
  id: number;
  displayName: string;
  country: string | null;
  seed: number | null;
}

/** Quién ganó CADA set en concreto, no el partido — para saber qué número resaltar en
 * negrita en la fila de un jugador que no ganó el partido pero sí se llevó algún set. */
function setWonBy(player: "winner" | "loser", sets: ScoreMatchRow["sets"]): boolean[] {
  return sets.map((s) => (player === "winner" ? s.winnerGames > s.loserGames : s.loserGames > s.winnerGames));
}

function PlayerLine({
  player,
  isMatchWinner,
  sets,
  perspective,
  outcomeLabel,
}: {
  player: ScorePlayer;
  isMatchWinner: boolean;
  sets: ScoreMatchRow["sets"];
  perspective: "winner" | "loser";
  outcomeLabel: string | null;
}) {
  const wonSets = setWonBy(perspective, sets);
  const scores = scoreFromPerspective(sets, perspective === "winner");
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <Link
        href={`/players/${player.id}`}
        className={`min-w-0 flex-1 truncate text-sm hover:underline ${isMatchWinner ? "text-headline text-ink" : "text-muted-label"}`}
      >
        {player.displayName}
        {player.seed && <span className="text-muted-label font-normal"> ({player.seed})</span>}
      </Link>
      {isMatchWinner && (
        <svg aria-label="Winner" viewBox="0 0 20 20" width="14" height="14" className="shrink-0 text-up">
          <path
            fill="currentColor"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
          />
        </svg>
      )}
      <div className="tour-numeric flex shrink-0 items-center gap-2">
        {scores.map((s, i) => (
          <span
            key={i}
            className={`relative w-4 text-center text-sm ${wonSets[i] ? "text-headline text-ink" : "text-muted-label"}`}
          >
            {s.games}
            {s.superscript !== null && <sup className="absolute -right-1 top-0 text-[9px] font-normal">{s.superscript}</sup>}
          </span>
        ))}
        {outcomeLabel && <span className="text-eyebrow text-[10px] text-muted-label">{outcomeLabel}</span>}
      </div>
    </div>
  );
}

export function ScoreMatchCard({ match, drawSize }: { match: ScoreMatchRow; drawSize: number }) {
  const outcomeLabel = OUTCOME_LABEL[match.outcome] ?? null;

  // Con el cuadro resuelto, se enseña en la posición real (arriba/abajo tal y como cae
  // en `matches`) en vez de "ganador siempre arriba" — el ganador se resalta donde le
  // toque. Sin cuadro resuelto (edición todavía sin cargar), cae al orden anterior.
  const winnerIsPlayer1 = match.draw ? match.draw.player1Id === match.winner.id : true;
  const topPlayer: ScorePlayer = winnerIsPlayer1
    ? { ...match.winner, seed: match.draw?.player1Seed ?? null }
    : { ...match.loser, seed: match.draw?.player2Seed ?? null };
  const bottomPlayer: ScorePlayer = winnerIsPlayer1
    ? { ...match.loser, seed: match.draw?.player2Seed ?? null }
    : { ...match.winner, seed: match.draw?.player1Seed ?? null };
  const topPerspective = winnerIsPlayer1 ? "winner" : "loser";
  const bottomPerspective = winnerIsPlayer1 ? "loser" : "winner";

  return (
    <div className="border-b border-rule px-4 py-4 last:border-0">
      <p className="text-eyebrow mb-1.5 text-[10px] text-muted-label">{roundPhrase(match.round, drawSize)}</p>
      <PlayerLine
        player={topPlayer}
        isMatchWinner={topPerspective === "winner"}
        sets={match.sets}
        perspective={topPerspective}
        outcomeLabel={topPerspective === "winner" ? outcomeLabel : null}
      />
      <PlayerLine
        player={bottomPlayer}
        isMatchWinner={bottomPerspective === "winner"}
        sets={match.sets}
        perspective={bottomPerspective}
        outcomeLabel={bottomPerspective === "winner" ? outcomeLabel : null}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-2">
        <p className="text-muted-label flex-1 text-xs italic">
          {matchSummary(match.outcome, match.winner.displayName, match.loser.displayName, match.sets)}
        </p>
        <Link
          href={`/h2h/${match.winner.id}/${match.loser.id}`}
          className="text-eyebrow shrink-0 rounded-full border border-rule px-3 py-1 text-[10px] text-blue-500 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          H2H
        </Link>
      </div>
    </div>
  );
}
