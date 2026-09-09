import Link from "next/link";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { scoreFromPerspective } from "@/lib/matchScore";
import { measureText } from "@/lib/textMeasure";

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

export interface MatchCardLiveRow {
  setGames: string[];
  currentPoint: string;
  serving: boolean;
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
  /** Presente solo cuando este cruce concreto (todavía `pending` en nuestros datos)
   * está EN VIVO ahora mismo en live-tennis.cn — ver lib/liveTennis/. `BracketColumns`
   * lo rellena buscando por pareja de ids, nunca se guarda en base de datos. */
  live?: { player1: MatchCardLiveRow; player2: MatchCardLiveRow; commentary: string | null };
  /** Hay fila(s) reales en `match_stats` para este partido (ver lib/matchLog/*) — solo
   * entonces tiene sentido enseñar el botón "Estadísticas" del pie (CLAUDE.md §6 ya
   * lo pedía desde el principio; hasta que existió esta tabla, nunca había datos que
   * enseñar). `undefined`/`false` para byes y cruces `pending`, que no pueden tenerlas. */
  hasStats?: boolean;
}

/** Altura fija de la tarjeta (2 filas de jugador + pie con el botón H2H) — la usa
 * también el cálculo de conectores del cuadro (`lib/bracketGeometry.ts`), tienen que
 * coincidir siempre. El pie se queda con esta misma altura reservada aunque ahora esté
 * vacío por defecto (los iconos solo aparecen al pasar el ratón): si encogiera,
 * descuadraría los conectores de todas las rondas siguientes. */
const ROW_HEIGHT = 44;
const FOOTER_HEIGHT = 30;
export const MATCH_CARD_HEIGHT = ROW_HEIGHT * 2 + 1 + FOOTER_HEIGHT;
// Ancho MÍNIMO/por defecto — el ancho real de cada tarjeta es dinámico
// (`measureRequiredCardWidth` más abajo), esto es solo el suelo por debajo del cual
// nunca baja aunque los dos nombres sean cortos.
export const MATCH_CARD_WIDTH = 300;

export const OUTCOME_LABEL: Record<Exclude<MatchCardData["outcome"], "played">, string> = {
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

// Réplica en números de la fila real de abajo (`PlayerRow`) — mismos px-3/gap-2/
// w-6/w-4 que las clases de Tailwind, para saber cuánto hueco pide de verdad sin
// tener que medir el DOM ya pintado (que llegaría un frame tarde).
const ROW_PADDING_X = 24; // px-3 a cada lado
const FLAG_WIDTH = 24; // h-4 w-6
// Antes gap-2.5 (10px), luego gap-2 (8px) con un margen negativo extra solo del lado
// seed→nombre para acercarlo más — pero eso dejaba las dos separaciones alrededor del
// seed DESIGUALES (más aire hacia la bandera que hacia el nombre), pedido explícito:
// más simétrico. `gap-1.5` uniforme para toda la fila consigue las dos cosas a la vez:
// más ajustado que el original Y con el mismo hueco a los dos lados del seed.
const ROW_GAP = 6; // gap-1.5
const CHECK_WIDTH = 16;
// Columna de seed SIEMPRE reservada (w-4), tenga o no seed este jugador concreto —
// bug real reportado: sin esto, la fila de un jugador sin seed no tenía nada que
// empujara su nombre, así que los dos nombres de la MISMA tarjeta no arrancaban en la
// misma X. Ancho fijo en vez de medir el texto: así el nombre nunca se desplaza según
// tenga 1 o 2 dígitos, siempre el mismo carril, como la propia bandera. Centrado
// dentro de esa columna — con un solo dígito real (1-9) queda centrado en su hueco en
// vez de pegado a la bandera; con dos dígitos (10-32) prácticamente llena la columna
// entera, así que centrado o no se ve casi igual. El `gap` de la fila (igual a los dos
// lados de la columna) es lo que mantiene la separación simétrica, no el propio texto.
const SEED_COL_WIDTH = 16; // w-4, cabe "32" (el draw más grande) en tour-numeric
const SCORE_COL_WIDTH = 16; // w-4 por número de sets, da igual el dígito (0-7, siempre uno solo)
const SCORE_GAP = 8; // gap-2 entre columnas de marcador

function measureNameWidth(player: MatchCardPlayer, isWinner: boolean): number {
  const isPlaceholder = player.id === BYE_PLAYER_ID || player.id === TBD_PLAYER_ID;
  if (isPlaceholder) {
    return measureText(player.id === BYE_PLAYER_ID ? "Bye" : "TBD", "text-base italic");
  }
  return measureText(player.displayName, `text-base ${isWinner ? "text-headline" : ""}`);
}

function measureRowRequiredWidth(
  player: MatchCardPlayer,
  isWinner: boolean,
  setCount: number,
  outcomeLabel: string | null,
): number {
  const nameWidth = measureNameWidth(player, isWinner);
  let numericWidth = setCount * SCORE_COL_WIDTH + Math.max(0, setCount - 1) * SCORE_GAP;
  if (outcomeLabel) {
    numericWidth += (setCount > 0 ? SCORE_GAP : 0) + measureText(outcomeLabel, "text-eyebrow text-[10px]");
  }
  const gapCount = isWinner ? 4 : 3; // flag-seed-name(-check)-numeric
  return ROW_PADDING_X + FLAG_WIDTH + SEED_COL_WIDTH + gapCount * ROW_GAP + nameWidth + (isWinner ? CHECK_WIDTH : 0) + numericWidth;
}

// Colchón de seguridad: nombre y marcador se miden por separado y se suman (clases
// distintas) — la suma de dos medidas independientes se queda a un par de px de la
// caja real cuando van en línea (kerning entre los dos "nodos", redondeo de
// subpíxel). Sin este margen, casos al límite (justo la anchura calculada) seguían
// partiéndose.
const SAFETY_MARGIN = 12;

/** Ancho real que le hace falta a esta tarjeta para que ninguno de los dos nombres se
 * parta en dos líneas — pedido explícito: la tarjeta crece dinámicamente en vez de
 * partir el nombre o quedarse corta con un ancho fijo adivinado (260, luego 300, luego
 * 340 — ninguno bastaba siempre). Nunca baja de `MATCH_CARD_WIDTH`. */
// Un cruce `pending` no enseña marcador normalmente (0 columnas), pero puede pasar a
// EN VIVO en cualquier momento sin que se vuelva a medir la ronda (el ancho se calcula
// una vez por ronda, antes de saber qué hay en vivo ahora mismo) — se reserva hueco
// para el caso más ancho posible (todos los sets de un partido a 3 más el punto en
// curso) para que la tarjeta no fuerce un reajuste de la columna al arrancar el vídeo.
const LIVE_RESERVED_NUMERIC_SLOTS = 4;

export function measureRequiredCardWidth(data: MatchCardData): number {
  const outcomeLabel = data.outcome !== "played" ? OUTCOME_LABEL[data.outcome] : null;
  const scores1 = setScoreFor("player1", data);
  const scores2 = setScoreFor("player2", data);
  const minSetCount = data.outcome === "pending" ? LIVE_RESERVED_NUMERIC_SLOTS : 0;
  const w1 = measureRowRequiredWidth(
    data.player1,
    data.winnerId === data.player1.id,
    Math.max(scores1.length, minSetCount),
    outcomeLabel,
  );
  const w2 = measureRowRequiredWidth(
    data.player2,
    data.winnerId === data.player2.id,
    Math.max(scores2.length, minSetCount),
    null,
  );
  return Math.max(MATCH_CARD_WIDTH, Math.ceil(w1) + SAFETY_MARGIN, Math.ceil(w2) + SAFETY_MARGIN);
}

function PlayerRow({
  player,
  isWinner,
  scores,
  wonSets,
  outcomeLabel,
  showOutcomeLabel,
  live,
}: {
  player: MatchCardPlayer;
  isWinner: boolean;
  scores: { games: number; superscript: number | null }[];
  wonSets: boolean[];
  /** Siempre el mismo texto en las dos filas (o null en las dos) — se pinta invisible
   * en la fila que no corresponde en vez de omitirse, para reservar el mismo ancho en
   * las dos filas (ver `showOutcomeLabel`). Si solo una fila reservara este hueco, esa
   * fila empujaría más su columna de nombre (que es `flex-1`, elástica) que la otra,
   * y las columnas de marcador de las dos filas dejarían de empezar en el mismo X —
   * bug real reportado, 2026-09-07 ("el RET. no debería desalinear el marcador"). */
  outcomeLabel: string | null;
  showOutcomeLabel: boolean;
  live?: MatchCardLiveRow;
}) {
  const isBye = player.id === BYE_PLAYER_ID;
  const isTbd = player.id === TBD_PLAYER_ID;
  const isPlaceholder = isBye || isTbd;

  return (
    <div
      style={{ minHeight: ROW_HEIGHT }}
      className={`flex items-center gap-1.5 px-3 py-1 ${
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
      <span className="tour-numeric text-muted-label w-4 shrink-0 text-center text-sm">
        {!isPlaceholder && player.seed ? player.seed : ""}
      </span>
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
      {live?.serving && <span aria-label="Serving" className="bg-down h-1.5 w-1.5 shrink-0 rounded-full" />}
      <div className="tour-numeric flex shrink-0 items-center gap-2">
        {live
          ? [
              ...live.setGames.map((g, i) => (
                <span key={i} className="text-muted-label w-4 text-center text-sm">
                  {g}
                </span>
              )),
              live.currentPoint && (
                <span key="point" className="text-headline text-ink w-5 text-center text-sm">
                  {live.currentPoint}
                </span>
              ),
            ]
          : scores.map((s, i) => (
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

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M4 16V9M10 16V4M16 16v-6" />
    </svg>
  );
}

export function MatchCard({
  data,
  width = MATCH_CARD_WIDTH,
  editionId,
}: {
  data: MatchCardData;
  width?: number;
  /** Solo hace falta para construir el enlace de "Estadísticas" — `data.hasStats`
   * decide si el icono llega a pintarse siquiera. */
  editionId?: number;
}) {
  const outcomeLabel = data.outcome !== "played" ? OUTCOME_LABEL[data.outcome] : null;
  const live = data.live;

  return (
    <div
      style={{ minHeight: MATCH_CARD_HEIGHT, width }}
      className="group relative rounded-lg border border-rule bg-paper shadow-sm transition-shadow duration-150 hover:shadow-md"
    >
      {live && (
        <span className="text-eyebrow absolute -top-2 right-2 flex items-center gap-1 rounded-full bg-down px-1.5 py-0.5 text-[9px] text-white">
          <span className="h-1 w-1 animate-pulse rounded-full bg-white" aria-hidden="true" />
          LIVE
        </span>
      )}
      <PlayerRow
        player={data.player1}
        isWinner={data.winnerId === data.player1.id}
        scores={setScoreFor("player1", data)}
        wonSets={setWinners("player1", data)}
        outcomeLabel={outcomeLabel}
        showOutcomeLabel={true}
        live={live?.player1}
      />
      <div className="border-t border-rule" />
      <PlayerRow
        player={data.player2}
        isWinner={data.winnerId === data.player2.id}
        scores={setScoreFor("player2", data)}
        wonSets={setWinners("player2", data)}
        outcomeLabel={outcomeLabel}
        showOutcomeLabel={false}
        live={live?.player2}
      />
      <div style={{ height: FOOTER_HEIGHT }} className="flex items-center justify-center gap-4 border-t border-rule px-2">
        {live ? (
          <p className="text-muted-label truncate text-center text-[11px] italic">{live.commentary ?? "Live"}</p>
        ) : (
          <>
            {data.player1.id > 0 && data.player2.id > 0 && (
              <Link
                href={`/h2h/${data.player1.id}/${data.player2.id}`}
                title="Head-to-head"
                className="text-eyebrow rounded border border-rule px-1.5 py-0.5 text-[10px] text-muted-label transition-colors duration-150 hover:border-blue-500 hover:text-blue-500"
              >
                H2H
              </Link>
            )}
            {data.youtubeVideoId && (
              <a
                href={`https://www.youtube.com/watch?v=${data.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Watch match"
                aria-label="Watch match"
                className="text-muted-label transition-colors duration-150 hover:text-down"
              >
                <PlayIcon />
              </a>
            )}
            {data.hasStats && editionId !== undefined && (
              <Link
                href={`/tournaments/${editionId}/matches/${data.id}`}
                title="Match stats"
                aria-label="Match stats"
                className="text-muted-label transition-colors duration-150 hover:text-blue-500"
              >
                <StatsIcon />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
