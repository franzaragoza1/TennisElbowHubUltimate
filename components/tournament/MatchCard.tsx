import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";

export interface MatchCardPlayer {
  id: number;
  displayName: string;
  country: string | null;
  seed: number | null;
}

export interface MatchCardSet {
  setNumber: number;
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

export interface MatchCardData {
  id: number;
  player1: MatchCardPlayer;
  player2: MatchCardPlayer;
  winnerId: number;
  outcome: "played" | "walkover" | "retired" | "disqualified" | "random";
  sets: MatchCardSet[];
}

/** Altura fija de la tarjeta (2 filas de jugador + pie con el botón H2H) — la usa
 * también el cálculo de conectores del cuadro (`lib/bracketGeometry.ts`), tienen que
 * coincidir siempre. */
const ROW_HEIGHT = 36;
const FOOTER_HEIGHT = 26;
export const MATCH_CARD_HEIGHT = ROW_HEIGHT * 2 + 1 + FOOTER_HEIGHT;

const OUTCOME_LABEL: Record<Exclude<MatchCardData["outcome"], "played">, string> = {
  walkover: "w.o.",
  retired: "ret.",
  disqualified: "DISQ",
  random: "RL",
};

function setScoreFor(
  player: "player1" | "player2",
  data: MatchCardData,
): { games: number; superscript: number | null }[] {
  const player1Won = data.winnerId === data.player1.id;
  return data.sets.map((s) => {
    const player1Games = player1Won ? s.winnerGames : s.loserGames;
    const player2Games = player1Won ? s.loserGames : s.winnerGames;
    const games = player === "player1" ? player1Games : player2Games;
    const opponentGames = player === "player1" ? player2Games : player1Games;
    const isSetLoser = games < opponentGames;
    return {
      games,
      superscript: isSetLoser ? s.tiebreakLoserPoints : null,
    };
  });
}

function PlayerRow({
  player,
  isWinner,
  scores,
  outcomeLabel,
}: {
  player: MatchCardPlayer;
  isWinner: boolean;
  scores: { games: number; superscript: number | null }[];
  outcomeLabel: string | null;
}) {
  return (
    <div style={{ height: ROW_HEIGHT }} className="flex items-center gap-2 px-2.5">
      <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={player.country} className="h-full w-full object-cover" />
      </span>
      <Link
        href={`/players/${player.id}`}
        className={`min-w-0 flex-1 truncate text-sm hover:underline ${
          isWinner ? "text-headline text-navy-900" : "text-navy-900"
        }`}
      >
        {player.displayName}
        {player.seed && <span className="text-muted-label ml-1 font-normal">({player.seed})</span>}
      </Link>
      {isWinner && (
        <svg aria-label="Winner" viewBox="0 0 20 20" width="14" height="14" className="shrink-0 text-up">
          <path
            fill="currentColor"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
          />
        </svg>
      )}
      <div className="tour-numeric flex shrink-0 items-center gap-1.5">
        {scores.map((s, i) => (
          <span key={i} className="relative w-3.5 text-center text-sm text-navy-900">
            {s.games}
            {s.superscript !== null && (
              <sup className="absolute -right-1 top-0 text-[9px]">{s.superscript}</sup>
            )}
          </span>
        ))}
        {outcomeLabel && (
          <span className="text-eyebrow text-[10px] text-muted-label">{outcomeLabel}</span>
        )}
      </div>
    </div>
  );
}

export function MatchCard({ data }: { data: MatchCardData }) {
  const outcomeLabel = data.outcome !== "played" ? OUTCOME_LABEL[data.outcome] : null;

  return (
    <div
      style={{ height: MATCH_CARD_HEIGHT }}
      className="w-56 overflow-hidden rounded-lg border border-rule bg-paper shadow-sm"
    >
      <PlayerRow
        player={data.player1}
        isWinner={data.winnerId === data.player1.id}
        scores={setScoreFor("player1", data)}
        outcomeLabel={outcomeLabel}
      />
      <div className="border-t border-rule" />
      <PlayerRow
        player={data.player2}
        isWinner={data.winnerId === data.player2.id}
        scores={setScoreFor("player2", data)}
        outcomeLabel={null}
      />
      <div
        style={{ height: FOOTER_HEIGHT }}
        className="flex items-center justify-center border-t border-rule bg-rule/20"
      >
        <Link
          href={`/h2h/${data.player1.id}/${data.player2.id}`}
          className="text-eyebrow text-[10px] text-blue-500 hover:underline"
        >
          H2H
        </Link>
      </div>
    </div>
  );
}
