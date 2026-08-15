import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { scoreFromPerspective } from "@/lib/matchScore";

export interface MatchCardPlayer {
  id: number;
  displayName: string;
  country: string | null;
  seed: number | null;
}

/** Un bye nunca tiene fila propia en `matches` (nunca se archivó — docs/estructura.md
 * §3), así que no es un jugador real: `app/tournaments/[id]/page.tsx` sintetiza esta
 * plaza con este id centinela cuando reconstruye el cuadro, para que la tarjeta se vea
 * como en la fuente (fila de "Bye" propia) en vez de faltar del todo. */
export const BYE_PLAYER_ID = -1;

/** Mismo criterio que `BYE_PLAYER_ID`, para el lado de un cruce que el cuadro fuente
 * todavía no ha resuelto ("TBD", ver `lib/tournamentStatus.ts` y
 * `parsers/schemas.ts::ParsedPendingSlot`). Nunca coincide con un id real de jugador. */
export const TBD_PLAYER_ID = -2;

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
  /** null = cruce todavía sin decidir (outcome "pending") — ninguno de los dos lados
   * tiene marcador, y puede que ni siquiera se sepa quién juega (ver TBD_PLAYER_ID). */
  winnerId: number | null;
  outcome: "played" | "walkover" | "retired" | "disqualified" | "random" | "bye" | "pending";
  sets: MatchCardSet[];
  /** VOD enlazado desde el canal de YouTube (ver lib/youtube/) — null si no hay ninguno. */
  youtubeVideoId: string | null;
}

/** Altura fija de la tarjeta (2 filas de jugador + pie con el botón H2H) — la usa
 * también el cálculo de conectores del cuadro (`lib/bracketGeometry.ts`), tienen que
 * coincidir siempre. El pie se queda con esta misma altura reservada aunque ahora esté
 * vacío por defecto (los iconos solo aparecen al pasar el ratón): si encogiera,
 * descuadraría los conectores de todas las rondas siguientes. */
const ROW_HEIGHT = 44;
const FOOTER_HEIGHT = 30;
export const MATCH_CARD_HEIGHT = ROW_HEIGHT * 2 + 1 + FOOTER_HEIGHT;
export const MATCH_CARD_WIDTH = 260;

const OUTCOME_LABEL: Record<Exclude<MatchCardData["outcome"], "played">, string> = {
  walkover: "w.o.",
  retired: "ret.",
  disqualified: "DISQ",
  random: "RL",
  bye: "",
  pending: "",
};

function setScoreFor(
  player: "player1" | "player2",
  data: MatchCardData,
): { games: number; superscript: number | null }[] {
  const playerWonMatch = data.winnerId === (player === "player1" ? data.player1.id : data.player2.id);
  return scoreFromPerspective(data.sets, playerWonMatch);
}

/** Quién ganó cada set EN CONCRETO (no el partido) — para resaltar ese número, no el
 * del ganador del partido si perdió ese set por el camino. */
function setWinners(player: "player1" | "player2", data: MatchCardData): boolean[] {
  const player1IsMatchWinner = data.winnerId === data.player1.id;
  return data.sets.map((s) => {
    const p1Games = player1IsMatchWinner ? s.winnerGames : s.loserGames;
    const p2Games = player1IsMatchWinner ? s.loserGames : s.winnerGames;
    return player === "player1" ? p1Games > p2Games : p2Games > p1Games;
  });
}

function PlayerRow({
  player,
  isWinner,
  scores,
  wonSets,
  outcomeLabel,
}: {
  player: MatchCardPlayer;
  isWinner: boolean;
  scores: { games: number; superscript: number | null }[];
  wonSets: boolean[];
  outcomeLabel: string | null;
}) {
  const isBye = player.id === BYE_PLAYER_ID;
  const isTbd = player.id === TBD_PLAYER_ID;
  const isPlaceholder = isBye || isTbd;

  return (
    <div
      style={{ minHeight: ROW_HEIGHT }}
      className={`flex items-center gap-2.5 px-3 py-1 ${
        isWinner ? "border-l-2 border-l-glow-500 bg-gradient-to-r from-glow-500/10 to-transparent" : "border-l-2 border-l-transparent"
      }`}
    >
      {isPlaceholder ? (
        <span className="h-4 w-6 shrink-0 rounded-sm bg-rule/40" />
      ) : (
        <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
          <CountryFlag country={player.country} className="h-full w-full object-cover" />
        </span>
      )}
      {isPlaceholder ? (
        <span className="text-muted-label min-w-0 flex-1 text-base italic">{isBye ? "Bye" : "TBD"}</span>
      ) : (
        <Link
          href={`/players/${player.id}`}
          className={`min-w-0 flex-1 break-words text-base hover:underline ${
            isWinner ? "text-headline text-glow-500" : "text-ink"
          }`}
        >
          {player.displayName}
          {player.seed && <span className="text-muted-label ml-1 font-normal">({player.seed})</span>}
        </Link>
      )}
      {isWinner && (
        <svg aria-label="Winner" viewBox="0 0 20 20" width="16" height="16" className="shrink-0 text-glow-500">
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
            {s.superscript !== null && (
              <sup className="absolute -right-1 top-0 text-[9px] font-normal">{s.superscript}</sup>
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

/** Icono ojo: "ver el H2H" — sustituye a la franja azul de "H2H" que estaba siempre
 * puesta; ahora solo aparece al pasar el ratón (o con foco, para teclado). */
function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
      <circle cx="10" cy="10" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function MatchCard({ data }: { data: MatchCardData }) {
  const outcomeLabel = data.outcome !== "played" ? OUTCOME_LABEL[data.outcome] : null;

  return (
    <div
      style={{ minHeight: MATCH_CARD_HEIGHT, width: MATCH_CARD_WIDTH }}
      className="group rounded-lg border border-rule bg-paper shadow-sm transition-shadow duration-150 hover:shadow-md"
    >
      <PlayerRow
        player={data.player1}
        isWinner={data.winnerId === data.player1.id}
        scores={setScoreFor("player1", data)}
        wonSets={setWinners("player1", data)}
        outcomeLabel={outcomeLabel}
      />
      <div className="border-t border-rule" />
      <PlayerRow
        player={data.player2}
        isWinner={data.winnerId === data.player2.id}
        scores={setScoreFor("player2", data)}
        wonSets={setWinners("player2", data)}
        outcomeLabel={null}
      />
      <div style={{ height: FOOTER_HEIGHT }} className="flex items-center justify-center gap-4 border-t border-rule">
        {data.player1.id > 0 && data.player2.id > 0 && (
          <Link
            href={`/h2h/${data.player1.id}/${data.player2.id}`}
            title="Head-to-head"
            aria-label="Head-to-head"
            className="text-muted-label opacity-0 transition-opacity duration-150 hover:text-blue-500 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <EyeIcon />
          </Link>
        )}
        {data.youtubeVideoId && (
          <a
            href={`https://www.youtube.com/watch?v=${data.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Watch match"
            aria-label="Watch match"
            className="text-muted-label opacity-0 transition-opacity duration-150 hover:text-down group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <PlayIcon />
          </a>
        )}
      </div>
    </div>
  );
}
