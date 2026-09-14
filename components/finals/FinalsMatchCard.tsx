import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";

export interface FinalsMatchCardPlayer {
  id: number;
  displayName: string;
  country: string | null;
}

export interface FinalsMatchCardSet {
  winnerGames: number;
  loserGames: number;
  tiebreakLoserPoints: number | null;
}

export interface FinalsMatchCardData {
  id: number;
  label: string; // "Semifinal 1", "Final"
  player1: FinalsMatchCardPlayer | null;
  player2: FinalsMatchCardPlayer | null;
  winnerId: number | null;
  outcome: "scheduled" | "played" | "retired" | "disqualified";
  sets: FinalsMatchCardSet[];
  /** `/tournaments/<edición espejo>/matches/<partido espejo>` — reusa la MISMA página
   * de estadísticas que un partido normal del tour, en vez de una ruta propia para
   * Finals: `match_stats` cuelga siempre del espejo real (lib/finals/mirror.ts), así
   * que la página ya sabe leerlo tal cual. `null` = sin estadísticas todavía (nunca se
   * pinta el botón). */
  statsHref: string | null;
}

/** Mismas medidas que `MatchCard` (cuadro principal) — misma altura de fila y de pie,
 * para que las dos tarjetas se lean como parte de la misma familia visual en vez de
 * como dos componentes distintos con un aire de familia. Ancho también igual a
 * `MATCH_CARD_WIDTH` (340). */
const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 44;
const FOOTER_HEIGHT = 30;
export const FINALS_CARD_WIDTH = 340;
export const FINALS_CARD_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 2 + 1 + FOOTER_HEIGHT;

const OUTCOME_LABEL: Record<Exclude<FinalsMatchCardData["outcome"], "scheduled" | "played">, string> = {
  retired: "ret.",
  disqualified: "DISQ",
};

function gamesFor(playerId: number | undefined, data: FinalsMatchCardData) {
  return data.sets.map((s) => {
    const won = data.winnerId === playerId;
    const value = won ? s.winnerGames : s.loserGames;
    const opponentValue = won ? s.loserGames : s.winnerGames;
    return { value, wonSet: value > opponentValue, superscript: value < opponentValue ? s.tiebreakLoserPoints : null };
  });
}

function PlayerRow({
  player,
  isWinner,
  games,
  outcomeLabel,
  showOutcomeLabel,
}: {
  player: FinalsMatchCardPlayer | null;
  isWinner: boolean;
  games: { value: number; wonSet: boolean; superscript: number | null }[];
  /** Siempre el mismo texto en las dos filas (o null en las dos) — ver el comentario en
   * `components/tournament/MatchCard.tsx::PlayerRow`: si solo una fila reservara este
   * hueco, su columna de nombre (`flex-1`, elástica) se encogería más que la de la
   * otra fila y las columnas de marcador dejarían de empezar en el mismo X. */
  outcomeLabel: string | null;
  showOutcomeLabel: boolean;
}) {
  return (
    <div
      style={{ height: ROW_HEIGHT }}
      className={`flex items-center gap-2.5 px-3 ${
        isWinner ? "border-l-2 border-l-glow-500 bg-gradient-to-r from-glow-500/10 to-transparent" : "border-l-2 border-l-transparent"
      }`}
    >
      <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
        {player && <CountryFlag country={player.country} className="h-full w-full object-cover" />}
      </span>
      {player ? (
        <Link
          href={`/players/${player.id}`}
          className={`min-w-0 flex-1 truncate text-base hover:underline ${isWinner ? "text-headline text-glow-500" : "text-ink"}`}
        >
          {player.displayName}
        </Link>
      ) : (
        <span className="text-muted-label min-w-0 flex-1 truncate text-base italic">TBD</span>
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
        {games.map((g, i) => (
          <span key={i} className={`relative w-4 text-center text-sm ${g.wonSet ? "text-headline text-ink" : "text-muted-label"}`}>
            {g.value}
            {g.superscript !== null && <sup className="absolute -right-1 top-0 text-[9px] font-normal">{g.superscript}</sup>}
          </span>
        ))}
        {outcomeLabel && (
          <span
            className={`text-eyebrow text-[10px] ${showOutcomeLabel ? "text-muted-label" : "invisible"}`}
            aria-hidden={showOutcomeLabel ? undefined : true}
          >
            {outcomeLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/** Tarjeta de partido de eliminatoria (SF/F). A diferencia de `MatchCard` (cuadro
 * principal, siempre con los dos jugadores puestos), aquí un cruce puede seguir sin
 * decidir — se pinta "TBD" en vez de romper. Comparte lenguaje visual con `MatchCard`
 * (filete de ganador, check, sets ganados en negrita, pie con enlace al H2H): antes era
 * una versión "de segunda" mucho más plana, y las dos tarjetas viven en el mismo sitio
 * (torneos vs. Finals) sin motivo para verse distintas. */
function StatsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M4 16V9M10 16V4M16 16v-6" />
    </svg>
  );
}

export function FinalsMatchCard({ data }: { data: FinalsMatchCardData }) {
  const outcomeLabel = data.outcome !== "scheduled" && data.outcome !== "played" ? OUTCOME_LABEL[data.outcome] : null;
  const canShowH2H = data.player1 !== null && data.player2 !== null && data.outcome !== "scheduled";

  return (
    <div
      style={{ minWidth: FINALS_CARD_WIDTH, width: "100%" }}
      className="group overflow-hidden rounded-lg border border-rule bg-paper shadow-sm transition-shadow duration-150 hover:shadow-md"
    >
      <div style={{ height: HEADER_HEIGHT }} className="text-eyebrow flex items-center border-b border-rule bg-paper-tint px-3 text-[10px] text-muted-label">
        {data.label}
      </div>
      <PlayerRow
        player={data.player1}
        isWinner={data.winnerId === data.player1?.id}
        games={gamesFor(data.player1?.id, data)}
        outcomeLabel={outcomeLabel}
        showOutcomeLabel={true}
      />
      <div className="border-t border-rule" />
      <PlayerRow
        player={data.player2}
        isWinner={data.winnerId === data.player2?.id}
        games={gamesFor(data.player2?.id, data)}
        outcomeLabel={outcomeLabel}
        showOutcomeLabel={false}
      />
      <div style={{ height: FOOTER_HEIGHT }} className="flex items-center justify-center gap-4 border-t border-rule">
        {canShowH2H && (
          <Link
            href={`/h2h/${data.player1!.id}/${data.player2!.id}`}
            title="Head-to-head"
            className="text-eyebrow rounded border border-rule px-1.5 py-0.5 text-[10px] text-muted-label transition-colors duration-150 hover:border-blue-500 hover:text-blue-500"
          >
            H2H
          </Link>
        )}
        {data.statsHref && (
          <Link
            href={data.statsHref}
            title="Match stats"
            aria-label="Match stats"
            className="text-muted-label transition-colors duration-150 hover:text-blue-500"
          >
            <StatsIcon />
          </Link>
        )}
      </div>
    </div>
  );
}
