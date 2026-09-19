"use client";

import { useMemo, useState } from "react";
import { buildBracketLayout, fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { computeWindowGeometry, CARD_WIDTH, COLUMN_GAP, CARD_HEIGHT } from "@/lib/bracketGeometry";
import { CountryFlag } from "@/components/rankings/CountryFlag";
import { BYE_PLAYER_ID } from "./MatchCard";
import { BracketConnectors } from "./BracketConnectors";
import { RoundChips } from "./RoundChips";
import type { TournamentBracketMatch } from "./BracketColumns";
import { submitPrediction } from "@/app/tournaments/[id]/predict/actions";
import type { BracketPick } from "@/lib/predictions/scoring";
import { useLiveScores } from "@/lib/liveTennis/useLiveScores";

const VISIBLE_ROUNDS = 2;
const PEEK_WIDTH = 56;

/** Mismo criterio que `lib/liveTennis/useLiveScores.ts::matchKey`, pero a partir de dos
 * ids sueltos en vez de un `LiveTourMatch` — no hace falta construir uno falso solo
 * para comparar. Exportada para que `lib/predictions/dummyPreview.ts` (previsualización
 * de desarrollo, ver el comentario de `PredictionBracket` más abajo) pueda construir su
 * propio set de "en vivo" ficticio con la misma clave exacta. */
export function pairKey(a: number, b: number): string {
  return [a, b].sort((x, y) => x - y).join("-");
}

interface ResolvedEntry {
  playerId: number;
  name: string;
  country: string | null;
}

interface Feeders {
  player1FeederId: number | null;
  player2FeederId: number | null;
}

/**
 * Rellenar un bracket entero de una sentada (pedido explícito, 2026-09-17) —
 * reutiliza la MISMA geometría/conectores del cuadro real (lib/bracketGeometry.ts,
 * BracketConnectors, RoundChips), pero cada tarjeta es clicable: elegir un ganador lo
 * hace avanzar al hueco de la ronda siguiente que alimenta, exactamente con la misma
 * regla 2k/2k+1 que dibuja el cuadro de verdad (lib/bracket.ts) — solo que aquí el
 * "ganador" de un hueco sin decidir todavía es el propio pick, no `matches.winnerId`.
 * Un bye nunca es una elección: avanza solo, mostrado pero no clicable.
 *
 * Ronda 1 a ritmo propio (pedido explícito, 2026-09-18): esta comunidad no juega toda
 * la ronda 1 a la vez como un cuadro de estadio, así que un hueco de R1 concreto puede
 * llevar YA decidido (partido real jugado, o bye) mientras otros de la misma ronda
 * siguen abiertos — ese hueco se enseña como jugado (resultado real, sin clic) en vez
 * de tratarlo como una elección más. Un hueco todavía sin decidir pero EN VIVO
 * (`useLiveScores`, mismo sondeo que el resto del sitio) tampoco se puede elegir —
 * verlo con el marcador en directo dejaría de ser una predicción de verdad. El envío
 * ya no exige tener el cuadro entero relleno: un envío parcial es válido, y se puede
 * volver a enviar más veces según la ronda 1 avanza (mismo upsert de siempre).
 *
 * `dummyMode`/`liveOverride` — previsualización de desarrollo (pedido explícito del
 * propietario, 2026-09-18, ver `lib/predictions/dummyPreview.ts` y
 * `PredictionBracketDevWrapper`): con datos ficticios en vez de un torneo real, no hay
 * `editionId` real contra el que llamar a `submitPrediction` ni un `useLiveScores` real
 * que vaya a encontrar el partido "en vivo" inventado — `dummyMode` simula el envío sin
 * red, `liveOverride` sustituye el sondeo real por un set fijo.
 */
export function PredictionBracket({
  matches,
  drawSize,
  editionId,
  initialPicks,
  locked,
  dummyMode = false,
  liveOverride,
}: {
  matches: TournamentBracketMatch[];
  drawSize: number;
  editionId: number;
  initialPicks: BracketPick[] | null;
  dummyMode?: boolean;
  liveOverride?: Set<string>;
  locked: boolean;
}) {
  const layout = useMemo(() => buildBracketLayout(matches), [matches]);

  // Un partido en vivo no se puede predecir (pedido explícito, 2026-09-18: "if a match
  // is live, that cant be predicted anymore") — mismo sondeo ya compartido con
  // LiveScoresStrip/el cuadro real/la ficha de jugador, aquí solo para bloquear el
  // clic mientras dure, nunca para resolver un ganador (eso sigue esperando a que el
  // partido termine de verdad y entre en `matches`).
  const { matches: liveMatches } = useLiveScores();
  const liveKeys = useMemo(
    () => liveOverride ?? new Set((liveMatches ?? []).map((m) => pairKey(m.player1.id, m.player2.id))),
    [liveOverride, liveMatches],
  );

  const feedersByMatchId = useMemo(() => {
    const map = new Map<number, Feeders>();
    for (const round of layout.roundOrder) {
      for (const positioned of layout.matchesByRound.get(round) ?? []) {
        map.set(positioned.match.id, { player1FeederId: positioned.player1FeederId, player2FeederId: positioned.player2FeederId });
      }
    }
    return map;
  }, [layout]);

  const [focusIndex, setFocusIndex] = useState(0);
  const [picksByMatchId, setPicksByMatchId] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    if (!initialPicks) return map;
    for (const round of layout.roundOrder) {
      const slots = layout.matchesByRound.get(round) ?? [];
      slots.forEach((s, i) => {
        const found = initialPicks.find((p) => p.round === round && p.slotIndex === i);
        if (found) map.set(s.match.id, found.playerId);
      });
    }
    return map;
  });
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Quién avanza de verdad en cada hueco.
  //
  // Un bye siempre se resuelve solo, en CUALQUIER vista — nunca fue una elección.
  //
  // En una vista BLOQUEADA (de lectura — el propio historial de alguien, o el de otro
  // predictor, ver PredictionBracketDevWrapper y app/tournaments/[id]/predict/[userId]/
  // page.tsx) el resto de huecos raíz enseñan SIEMPRE el pick guardado tal cual,
  // acertara o no — bug real corregido, 2026-09-18: antes esta misma rama sustituía
  // cualquier hueco ya decidido por el ganador REAL sin importar de quién fuera la
  // predicción, así que el marcador de acierto salía bien (viene de `scorePrediction`,
  // que sí lee los picks guardados directamente) pero el propio cuadro pintado enseñaba
  // el resultado real en vez de lo que esa persona había predicho — imposible saber
  // quién acertó qué con solo mirar el cuadro.
  //
  // En una vista EDITABLE (todavía sin bloquear), un hueco raíz YA DECIDIDO (partido
  // real jugado) sí se resuelve solo con el resultado real, sin importar ningún pick
  // guardado (pedido explícito, 2026-09-18: la ronda 1 de este tour se juega a ritmo
  // propio, así que puede haber huecos ya decididos mientras otros de la misma ronda
  // siguen abiertos). Uno todavía sin decidir y EN VIVO tampoco se resuelve (no hay
  // ganador todavía) ni se puede elegir.
  //
  // El resto de rondas (con alimentador) solo se resuelven si sus dos alimentadores YA
  // están resueltos y el pick guardado sigue siendo uno de ellos — funciona igual en
  // las dos vistas sin distinción propia, porque ya depende solo de `picksByMatchId` y
  // de lo que el hueco raíz haya resuelto arriba.
  const resolved = useMemo(() => {
    const map = new Map<number, ResolvedEntry>();
    for (const round of layout.roundOrder) {
      for (const positioned of layout.matchesByRound.get(round) ?? []) {
        const { match, player1FeederId, player2FeederId } = positioned;
        if (player1FeederId === null && player2FeederId === null) {
          const isBye = match.outcome === "bye";
          if (isBye) {
            const real = match.player1.id > 0 ? match.player1 : match.player2;
            map.set(match.id, { playerId: real.id, name: real.displayName, country: real.country });
            continue;
          }
          if (locked) {
            const pick = picksByMatchId.get(match.id);
            if (pick === match.player1.id) map.set(match.id, { playerId: match.player1.id, name: match.player1.displayName, country: match.player1.country });
            else if (pick === match.player2.id) map.set(match.id, { playerId: match.player2.id, name: match.player2.displayName, country: match.player2.country });
            continue;
          }
          if (match.winnerId !== null && match.winnerId > 0) {
            const winner = match.player1.id === match.winnerId ? match.player1 : match.player2;
            map.set(match.id, { playerId: winner.id, name: winner.displayName, country: winner.country });
          } else if (match.player1.id > 0 && match.player2.id > 0 && !liveKeys.has(pairKey(match.player1.id, match.player2.id))) {
            const pick = picksByMatchId.get(match.id);
            if (pick === match.player1.id) map.set(match.id, { playerId: match.player1.id, name: match.player1.displayName, country: match.player1.country });
            else if (pick === match.player2.id) map.set(match.id, { playerId: match.player2.id, name: match.player2.displayName, country: match.player2.country });
          }
          continue;
        }
        const c1 = player1FeederId !== null ? map.get(player1FeederId) : undefined;
        const c2 = player2FeederId !== null ? map.get(player2FeederId) : undefined;
        if (!locked && c1 && c2 && liveKeys.has(pairKey(c1.playerId, c2.playerId))) continue;
        const pick = picksByMatchId.get(match.id);
        const chosen = [c1, c2].find((c) => c?.playerId === pick);
        if (chosen) map.set(match.id, chosen);
      }
    }
    return map;
  }, [layout, picksByMatchId, liveKeys, locked]);

  function pick(matchId: number, playerId: number) {
    if (locked) return;
    setJustSubmitted(false);
    setPicksByMatchId((prev) => {
      const next = new Map(prev);
      next.set(matchId, playerId);
      return next;
    });
  }

  const cardWidthByRound = useMemo(() => {
    const map = new Map<string, number>();
    for (const round of layout.roundOrder) map.set(round, CARD_WIDTH);
    return map;
  }, [layout]);

  const geometry = useMemo(() => computeWindowGeometry(layout, focusIndex, VISIBLE_ROUNDS + 1, cardWidthByRound), [layout, focusIndex, cardWidthByRound]);

  const ladder = fullRoundLadder(drawSize);
  const labels = layout.roundOrder.map((r) => roundDisplayLabel(ladder, r));
  const lastIndex = Math.max(0, layout.roundOrder.length - 1);
  const windowEnd = Math.min(focusIndex + VISIBLE_ROUNDS - 1, lastIndex);

  function goTo(index: number) {
    setFocusIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  const visibleRounds = layout.roundOrder.slice(focusIndex, focusIndex + VISIBLE_ROUNDS);
  const visibleWidth = visibleRounds.reduce((sum, round) => sum + (cardWidthByRound.get(round) ?? CARD_WIDTH) + COLUMN_GAP, 0);
  const viewportWidth = Math.max(0, visibleWidth - COLUMN_GAP) + PEEK_WIDTH;

  // Un bye (o ya cualquier hueco de R1 ya decidido) se resuelve solo, así que
  // comparar contra el total de huecos deja el contador consistente sin tener que
  // excluir nada aparte. Ya NO hace falta llegar al total para poder enviar (pedido
  // explícito, 2026-09-18) — un envío parcial es válido mientras la ronda 1 se va
  // jugando a ritmo propio; solo hace falta al menos un hueco resuelto de verdad.
  const totalSlotsCount = layout.roundOrder.reduce((sum, round) => sum + (layout.matchesByRound.get(round)?.length ?? 0), 0);
  const resolvedCount = resolved.size;

  async function handleSubmit() {
    setError(null);
    setIsPending(true);
    const picks: BracketPick[] = [];
    for (const round of layout.roundOrder) {
      const slots = layout.matchesByRound.get(round) ?? [];
      slots.forEach((s, slotIndex) => {
        const entry = resolved.get(s.match.id);
        if (entry) picks.push({ round, slotIndex, playerId: entry.playerId });
      });
    }
    if (dummyMode) {
      // Cuadro ficticio: no hay `editionId` real contra el que enviar nada, esto solo
      // simula el mensaje de éxito para probar el pintado de la UI.
      await new Promise((r) => setTimeout(r, 300));
      setIsPending(false);
      setJustSubmitted(true);
      return;
    }
    const result = await submitPrediction(editionId, picks);
    setIsPending(false);
    if (result.error) setError(result.error);
    else setJustSubmitted(true);
  }

  if (layout.roundOrder.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RoundChips labels={labels} activeIndex={focusIndex} onSelect={goTo} />
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => goTo(focusIndex - 1)}
              disabled={focusIndex === 0}
              aria-label="Previous round"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-muted-label transition-colors hover:border-navy-900 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => goTo(focusIndex + 1)}
              disabled={windowEnd >= lastIndex}
              aria-label="Next round"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-muted-label transition-colors hover:border-navy-900 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
        {!locked && (
          <div className="flex items-center gap-3">
            <span className="text-muted-label text-xs">
              {resolvedCount}/{totalSlotsCount} picked
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || resolvedCount === 0}
              className="text-eyebrow rounded-full bg-navy-900 px-5 py-2 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {isPending ? "Submitting…" : "Submit bracket"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-down mb-3 text-xs">{error}</p>}
      {justSubmitted && (
        <p className="text-up mb-3 text-xs">
          Bracket submitted — come back and add more picks as the round goes on, right up until it locks.
        </p>
      )}

      <div className="scrollbar-hidden overflow-x-auto overflow-y-hidden" style={{ width: viewportWidth, maxWidth: "100%", height: geometry.height + 16 }}>
        <div className="relative" style={{ width: geometry.width, height: geometry.height }}>
          <BracketConnectors connectors={geometry.connectors} width={geometry.width} height={geometry.height} />
          {geometry.cards.map(({ match, x, y, width }) => (
            <div key={match.id} className="absolute" style={{ left: x, top: y, width }}>
              <PredictionMatchCard
                match={match}
                width={width}
                feeders={feedersByMatchId.get(match.id) ?? { player1FeederId: null, player2FeederId: null }}
                resolved={resolved}
                locked={locked}
                liveKeys={liveKeys}
                onPick={pick}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  isBye,
  isPicked,
  clickable,
  live,
  correct,
  realWinnerName,
  onClick,
}: {
  candidate: ResolvedEntry | null;
  isBye: boolean;
  isPicked: boolean;
  clickable: boolean;
  /** El cruce está en juego ahora mismo — no se puede elegir todavía porque no hay
   * ganador de verdad, pero tampoco porque no convenga: se ve el marcador en vivo en
   * otra parte del sitio y adivinarlo dejaría de ser una predicción de verdad. */
  live: boolean;
  /** Solo tiene sentido para el hueco YA DECIDIDO de una vista bloqueada — pedido
   * explícito del propietario, 2026-09-18: "i should be able to see what i picked
   * wrong". `null` = todavía no hay nada que comparar (sin bloquear, o este hueco en
   * concreto sigue sin decidir) — ahí el pick se enseña neutro, igual que antes. */
  correct: boolean | null;
  /** Solo se usa cuando `correct === false` — pedido explícito del propietario,
   * 2026-09-18: "Show the Correct name next to the wrong pick". Va pegado al aviso de
   * fallo en vez de en una segunda línea: la fila tiene una altura fija que ya usan los
   * conectores del cuadro (lib/bracketGeometry.ts) para su propio cálculo, así que
   * crecerla rompería esa geometría — el propio nombre (`truncate`) cede el espacio que
   * haga falta en vez de forzar la fila a ser más alta. */
  realWinnerName: string | null;
  onClick: () => void;
}) {
  if (isBye) {
    return (
      <div style={{ minHeight: CARD_HEIGHT / 2 }} className="flex items-center gap-2 px-3 py-1">
        <span className="text-muted-label text-sm italic">Bye</span>
      </div>
    );
  }
  if (!candidate) {
    return (
      <div style={{ minHeight: CARD_HEIGHT / 2 }} className="flex items-center gap-2 px-3 py-1">
        <span className="text-muted-label truncate text-sm italic">TBD</span>
      </div>
    );
  }
  const pickedBg = !isPicked ? "" : correct === true ? "bg-up/10" : correct === false ? "bg-down/10" : "bg-blue-500/10";
  const pickedMark = correct === true ? "text-up" : correct === false ? "text-down" : "text-blue-500";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      style={{ minHeight: CARD_HEIGHT / 2 }}
      className={`flex w-full items-center gap-2 px-3 py-1 text-left transition-colors ${pickedBg} ${clickable ? "hover:bg-paper-tint" : ""}`}
    >
      <span className="h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-rule">
        <CountryFlag country={candidate.country} className="h-full w-full object-cover" />
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${isPicked ? "text-headline text-ink" : "text-ink"}`}>{candidate.name}</span>
      {live && <span className="text-eyebrow shrink-0 text-[10px] text-down">● LIVE</span>}
      {isPicked && correct === false && realWinnerName ? (
        <span className={`${pickedMark} shrink-0 text-xs whitespace-nowrap`}>✗ {realWinnerName}</span>
      ) : (
        isPicked && <span className={pickedMark}>{correct === false ? "✗" : "✓"}</span>
      )}
    </button>
  );
}

function PredictionMatchCard({
  match,
  width,
  feeders,
  resolved,
  locked,
  liveKeys,
  onPick,
}: {
  match: TournamentBracketMatch;
  width: number;
  feeders: Feeders;
  resolved: Map<number, ResolvedEntry>;
  locked: boolean;
  liveKeys: Set<string>;
  onPick: (matchId: number, playerId: number) => void;
}) {
  const isRootSlot = feeders.player1FeederId === null && feeders.player2FeederId === null;
  const entry = resolved.get(match.id);
  // Ya decidido de verdad (partido real jugado, o bye) — la ronda 1 de este tour se
  // juega a ritmo propio, así que este hueco concreto puede estar resuelto mientras
  // otros de la misma ronda siguen abiertos (pedido explícito, 2026-09-18). Solo
  // aplica a un hueco raíz: uno con alimentadores ya implicaría bloqueo total del
  // cuadro entero (ver el comentario de `getPredictionLockInfo`).
  const isDecided = isRootSlot && match.winnerId !== null && match.winnerId > 0;

  // Acierto o fallo del pick DE VERDAD para este hueco concreto — comparar
  // `entry.playerId` (el pick real, en vista bloqueada, ver el comentario de
  // `resolved` más arriba) contra `match.winnerId` (el ganador real de ESTA posición
  // del cuadro, venga o no de ahí el propio candidato mostrado — un hueco cuyo
  // alimentador diverge de la realidad, como una semifinal que en la vida real nunca
  // llegó a jugarse porque el pick de una ronda anterior falló, sigue teniendo un
  // ganador real conocido en ESA posición exacta, que es contra lo que puntúa
  // `scorePrediction`). `null` = nada que comparar todavía (sin bloquear, hueco sin
  // decidir, o sin pick guardado para este hueco).
  const pickCorrect = locked && match.winnerId !== null && match.winnerId > 0 && entry !== undefined ? entry.playerId === match.winnerId : null;
  // Nombre de quién ganó DE VERDAD esta posición — solo hace falta calcularlo cuando el
  // pick falló, para enseñarlo junto al aviso (pedido explícito, 2026-09-18).
  const realWinnerName = pickCorrect === false ? (match.player1.id === match.winnerId ? match.player1.displayName : match.player2.displayName) : null;

  let row1: { candidate: ResolvedEntry | null; isBye: boolean };
  let row2: { candidate: ResolvedEntry | null; isBye: boolean };

  if (isRootSlot) {
    row1 = { candidate: match.player1.id > 0 ? { playerId: match.player1.id, name: match.player1.displayName, country: match.player1.country } : null, isBye: match.player1.id === BYE_PLAYER_ID };
    row2 = { candidate: match.player2.id > 0 ? { playerId: match.player2.id, name: match.player2.displayName, country: match.player2.country } : null, isBye: match.player2.id === BYE_PLAYER_ID };
  } else {
    row1 = { candidate: feeders.player1FeederId !== null ? (resolved.get(feeders.player1FeederId) ?? null) : null, isBye: false };
    row2 = { candidate: feeders.player2FeederId !== null ? (resolved.get(feeders.player2FeederId) ?? null) : null, isBye: false };
  }

  const live = !isDecided && row1.candidate !== null && row2.candidate !== null && liveKeys.has(pairKey(row1.candidate.playerId, row2.candidate.playerId));
  const clickable = !locked && !isDecided && !live && row1.candidate !== null && row2.candidate !== null;

  return (
    <div style={{ minHeight: 2 * (CARD_HEIGHT / 2) + 1, width }} className="rounded-lg border border-rule bg-paper shadow-sm">
      <CandidateRow
        candidate={row1.candidate}
        isBye={row1.isBye}
        isPicked={entry?.playerId === row1.candidate?.playerId && row1.candidate !== null}
        clickable={clickable}
        live={live}
        correct={pickCorrect}
        realWinnerName={realWinnerName}
        onClick={() => row1.candidate && onPick(match.id, row1.candidate.playerId)}
      />
      <div className="border-t border-rule" />
      <CandidateRow
        candidate={row2.candidate}
        isBye={row2.isBye}
        isPicked={entry?.playerId === row2.candidate?.playerId && row2.candidate !== null}
        clickable={clickable}
        live={live}
        correct={pickCorrect}
        realWinnerName={realWinnerName}
        onClick={() => row2.candidate && onPick(match.id, row2.candidate.playerId)}
      />
    </div>
  );
}
