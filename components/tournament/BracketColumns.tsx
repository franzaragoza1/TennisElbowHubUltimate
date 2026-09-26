"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildBracketLayout, fullRoundLadder, roundDisplayLabel, type BracketMatchInput } from "@/lib/bracket";
import { computeWindowGeometry, CARD_WIDTH, COLUMN_GAP } from "@/lib/bracketGeometry";
import { useLiveScores, matchKey } from "@/lib/liveTennis/useLiveScores";
import type { LiveMatchPlayer } from "@/lib/liveTennis/resolveAgainstOngoing";
import { MatchCard, measureRequiredCardWidth, type MatchCardData } from "./MatchCard";
import { BracketConnectors } from "./BracketConnectors";
import { RoundChips } from "./RoundChips";
import { CompactBracket } from "./CompactBracket";
import { PathPanel } from "./PathPanel";
import { isPathConnector, matchIdsInvolving } from "@/lib/bracketPath";

// `round` explícito aquí: `BracketMatchInput.round` es obligatorio, `MatchCardData.round`
// es opcional (Finals no siempre la trae, ver su comentario) — sin esta redeclaración,
// TypeScript rechaza la combinación de las dos interfaces por ese choque de tipos.
// Todo cruce de torneo normal (nunca Finals) SÍ la trae siempre, así que queda
// obligatoria aquí, que es lo que de verdad usan los constructores de este tipo.
export interface TournamentBracketMatch extends BracketMatchInput, MatchCardData {
  round: string;
}

/** Cuántas rondas se enseñan a la vez en la ventana COMO MÍNIMO — 2 completas más una
 * pizca de la siguiente asomando (como en la referencia ATP), para que se note que hay
 * más cuadro a la derecha sin tener que enseñarlo entero. Es un suelo, no un techo: si
 * el contenedor tiene sitio de sobra (pantalla ancha, pocas rondas totales) se enseñan
 * más — pedido explícito, 2026-09-18: quedarse en 2 aunque sobre hueco real a la
 * derecha se veía como una columna vacía sin motivo. */
const VISIBLE_ROUNDS = 2;
const PEEK_WIDTH = 56;

/** Antes reservaba hueco bajo el cuadro para la barra de scroll horizontal nativa
 * (clásica, no flotante — Windows/Linux en la mayoría de navegadores), que se comía
 * ese alto por dentro del propio contenedor con scroll y tapaba la fila de abajo del
 * todo (bug real reportado). Ahora la barra nativa está oculta del todo (`.scrollbar-
 * hidden`, ver globals.css — pedido explícito, "remove [the scrollbar]"), así que ya
 * no hay nada que tapar; se deja igual como un margen inferior discreto, no hace falta
 * quitarlo. */
const SCROLLBAR_RESERVE_PX = 16;

type BracketView = "zoomed" | "compact";
const VIEW_STORAGE_KEY = "bracket-view";

/** Misma pareja sin importar quién es player1/player2 en cada lado — los ids de
 * `LiveTourMatch.player1/player2` son literalmente `pending_slots.player1_id/2_id`
 * (ver lib/liveTennis/resolveAgainstOngoing.ts, se copian tal cual), así que coinciden
 * 1:1 con `match.player1Id/player2Id` del propio cuadro sin falta de reconciliar nada
 * más — pero la clave se ordena igualmente para no depender de ese orden. */
function pairKey(a: number, b: number): string {
  return [a, b].sort((x, y) => x - y).join("-");
}

export function BracketColumns({
  matches,
  drawSize,
  editionId,
}: {
  matches: TournamentBracketMatch[];
  drawSize: number;
  editionId: number;
}) {
  const layout = useMemo(() => buildBracketLayout(matches), [matches]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [view, setView] = useState<BracketView>("zoomed");
  // Jugador cuyo recorrido se está siguiendo — compartido por las dos vistas.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const involvedMatchIds = useMemo(() => matchIdsInvolving(matches, selectedId), [matches, selectedId]);

  function toggleSelected(id: number) {
    setSelectedId((cur) => (cur === id ? null : id));
  }

  // Se recuerda la elección de este navegador (pedido de la comunidad: en móvil el
  // cuadro se ve enorme y hay que pasar a la vista de escritorio) — solo una comodidad
  // por espectador, así que cualquier fallo de almacenamiento (ventana privada, datos
  // bloqueados) simplemente se ignora y se queda en "zoomed".
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_STORAGE_KEY) === "compact") {
        // A propósito: leer localStorage necesita `window`, no puede ir en el render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView("compact");
      }
    } catch {
      /* sin almacenamiento: se queda en "zoomed" */
    }
  }, []);

  function chooseView(next: BracketView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* sin almacenamiento: la elección solo dura esta visita */
    }
  }

  // Partidos `pending` de este cuadro que están en vivo ahora mismo, ver
  // lib/liveTennis/ — mismo sondeo compartido que usan /scores y la ficha de jugador,
  // filtrado a esta edición. No hace falta re-medir el ancho de columna cuando esto
  // cambia: `measureRequiredCardWidth` ya reserva hueco para el caso en vivo en
  // cualquier tarjeta `pending` (ver MatchCard.tsx).
  const { matches: liveMatches, commentaryByMatch } = useLiveScores();
  // Sin filtrar por edición aquí a propósito: `LiveTourMatch` ya no lleva `editionId`
  // (un partido de Finals no tiene uno hasta que se decide y se espeja), y no hace
  // falta — más abajo solo se consulta `liveByPair` para partidos `pending` que ya son
  // de ESTE cuadro (`match.player1Id/player2Id`), así que un partido en vivo de otro
  // torneo simplemente nunca calza con ningún par de este cuadro.
  const liveByPair = useMemo(() => {
    const map = new Map<string, { player1: LiveMatchPlayer; player2: LiveMatchPlayer; commentary: string | null }>();
    for (const m of liveMatches ?? []) {
      map.set(pairKey(m.player1.id, m.player2.id), {
        player1: m.player1,
        player2: m.player2,
        commentary: commentaryByMatch.get(matchKey(m)) ?? null,
      });
    }
    return map;
  }, [liveMatches, commentaryByMatch]);

  const liveMatchIds = useMemo(() => {
    const ids = new Set<number>();
    for (const list of layout.matchesByRound.values()) {
      for (const pm of list) {
        if (pm.match.outcome === "pending" && liveByPair.has(pairKey(pm.match.player1Id, pm.match.player2Id))) ids.add(pm.match.id);
      }
    }
    return ids;
  }, [layout, liveByPair]);

  // Ancho real de cada ronda — el que le haga falta a su nombre más largo, medido de
  // verdad (ver MatchCard.tsx::measureRequiredCardWidth), no un ancho fijo adivinado.
  // Se calcula para el cuadro entero (no solo la ventana visible) para que no cambie
  // de tamaño al navegar de ronda en ronda.
  //
  // A propósito en un `useEffect`, NUNCA en el cuerpo del render ni en un `useMemo`
  // normal: medir texto necesita `document`, que no existe en el servidor — la
  // página se sirve estática (`revalidate`), así que el primer render SIEMPRE pasa
  // por el servidor. Si esta cuenta se hiciera en el render, el HTML del servidor
  // saldría con el ancho por defecto (measureText devuelve 0 sin DOM) y React, al
  // hidratar, detecta el desajuste con lo que calcula el cliente pero **no lo
  // corrige** ("This won't be patched up" — así se comporta la hidratación a
  // propósito, por rendimiento) — la tarjeta se quedaba congelada en el ancho mínimo
  // para siempre, aunque el valor calculado en el navegador fuera el correcto. Un
  // efecto corre solo en el cliente, después de montar, así que el primer pintado
  // (servidor + hidratación) siempre coincide (ancho por defecto en los dos) y el
  // ancho real llega en un segundo pase, ya sin nada que hidratar.
  const [cardWidthByRound, setCardWidthByRound] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const map = new Map<string, number>();
    for (const round of layout.roundOrder) {
      const list = layout.matchesByRound.get(round) ?? [];
      let max = CARD_WIDTH;
      for (const pm of list) max = Math.max(max, measureRequiredCardWidth(pm.match));
      map.set(round, max);
    }
    // A propósito, ver el comentario de arriba: medir texto necesita `document` y no
    // puede pasar por render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardWidthByRound(map);
  }, [layout]);

  // Ancho real disponible para el propio componente — el suelo de `VISIBLE_ROUNDS`
  // sigue rigiendo en móvil (donde esto normalmente no llega a caber, y ya se confía en
  // el scroll horizontal a propósito, ver más abajo), pero en un contenedor ancho de
  // sobra permite enseñar más rondas de una vez en vez de recortar a 2 siempre.
  // `ResizeObserver`, no solo una medida al montar: la sección "Ongoing Now"/el ancho
  // del layout puede cambiar sin que este componente se desmonte.
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setAvailableWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cuántas rondas completas caben de verdad a partir de `focusIndex`, nunca menos de
  // `VISIBLE_ROUNDS` (ese suelo es el que sostiene el diseño en móvil, con scroll para
  // el resto) — antes de tener una medida real (primer render, servidor) se asume el
  // suelo, igual que `cardWidthByRound` antes de medirse.
  const visibleRoundsCount = useMemo(() => {
    if (availableWidth === null) return VISIBLE_ROUNDS;
    const remaining = layout.roundOrder.length - focusIndex;
    let count = 0;
    let used = 0;
    for (let i = 0; i < remaining; i++) {
      const round = layout.roundOrder[focusIndex + i];
      const width = cardWidthByRound.get(round) ?? CARD_WIDTH;
      const next = used + (count > 0 ? COLUMN_GAP : 0) + width;
      if (count >= VISIBLE_ROUNDS && next > availableWidth) break;
      used = next;
      count++;
    }
    return Math.max(VISIBLE_ROUNDS, count);
  }, [availableWidth, cardWidthByRound, focusIndex, layout.roundOrder]);

  // Una ronda extra (la del "asomo") para que su columna exista en la geometría, aunque
  // el contenedor solo deje ver una pizca de ancho de ella.
  const geometry = useMemo(
    () => computeWindowGeometry(layout, focusIndex, visibleRoundsCount + 1, cardWidthByRound),
    [layout, focusIndex, visibleRoundsCount, cardWidthByRound],
  );

  // La escalera COMPLETA del cuadro (no solo las rondas ya decididas) — un torneo a
  // medias necesita saber que Q/S/F existen más adelante para no confundir la última
  // ronda con datos con la Final de verdad (ver el aviso en lib/bracket.ts).
  const ladder = fullRoundLadder(drawSize);
  const labels = layout.roundOrder.map((r) => roundDisplayLabel(ladder, r));
  const labelByRound = new Map(layout.roundOrder.map((r, i) => [r, labels[i]]));
  const lastIndex = Math.max(0, layout.roundOrder.length - 1);
  const windowEnd = Math.min(focusIndex + visibleRoundsCount - 1, lastIndex);

  function goTo(index: number) {
    setFocusIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  if (layout.roundOrder.length === 0) {
    return <p className="text-muted-label py-8">Este torneo todavía no tiene cuadro.</p>;
  }

  // Igual que `geometry.width`, pero solo para las rondas de verdad visibles (sin la
  // del "asomo" completa) — el contenedor recorta el resto con overflow-hidden. El
  // "asomo" solo se reserva si de verdad queda otra ronda después de la ventana —
  // enseñar TODO el cuadro no debe dejar un hueco de sobra a la derecha sin nada ahí.
  const visibleRounds = layout.roundOrder.slice(focusIndex, focusIndex + visibleRoundsCount);
  const visibleWidth = visibleRounds.reduce((sum, round) => sum + (cardWidthByRound.get(round) ?? CARD_WIDTH) + COLUMN_GAP, 0);
  const hasPeekRound = focusIndex + visibleRoundsCount < layout.roundOrder.length;
  const viewportWidth = Math.max(0, visibleWidth - COLUMN_GAP) + (hasPeekRound ? PEEK_WIDTH : 0);

  return (
    <div ref={containerRef}>
      <div className="mb-3 flex justify-end">
        <ViewToggle view={view} onChange={chooseView} />
      </div>
      <p className="text-muted-label mb-3 text-xs">
        {view === "compact" ? "Tap a player" : "Tap a flag"} to trace their path and see who they could face.
      </p>
      {selectedId !== null && (
        <PathPanel layout={layout} selectedId={selectedId} labelByRound={labelByRound} onSelect={setSelectedId} onClear={() => setSelectedId(null)} />
      )}
      <div className="flex items-center gap-2">
        {view === "zoomed" && <RoundChips labels={labels} activeIndex={focusIndex} onSelect={goTo} />}
        {view === "zoomed" && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => goTo(focusIndex - 1)}
            disabled={focusIndex === 0}
            aria-label="Previous round"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-muted-label transition-colors hover:border-navy-900 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => goTo(focusIndex + 1)}
            disabled={windowEnd >= lastIndex}
            aria-label="Next round"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-muted-label transition-colors hover:border-navy-900 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
        )}
      </div>

      {view === "compact" ? (
        <CompactBracket
          layout={layout}
          labels={labels}
          liveMatchIds={liveMatchIds}
          availableWidth={availableWidth}
          selectedId={selectedId}
          onSelect={toggleSelected}
        />
      ) : (
      <>

      {/* La geometría ya viene recalculada en local solo para esta ventana (ver
       * lib/bracketGeometry.ts::computeWindowGeometry) — la altura del contenedor es
       * exactamente la que hace falta, sin trasladar ni recortar un lienzo compartido
       * con el cuadro entero.
       *
       * `overflow-x-auto` (antes `overflow-hidden`) a propósito: en un móvil estrecho
       * `viewportWidth` puede seguir siendo más ancho que la pantalla (dos rondas más
       * el "asomo"), y `measureRequiredCardWidth` (MatchCard.tsx) no tiene techo — un
       * nombre largo con un partido a 5 sets puede por sí solo superar los 375-430px
       * de un teléfono. Con `overflow-hidden` ese sobrante quedaba recortado sin
       * ninguna forma de llegar a verlo, ni deslizando ni con los chips/flechas (que
       * solo cambian de RONDA, no desplazan dentro de una ronda ya demasiado ancha).
       * `overflow-x-auto` no toca la navegación por rondas ni el cálculo de geometría,
       * solo hace que cualquier sobrante sea alcanzable con un gesto. */}
      <div
        className="scrollbar-hidden mt-4 overflow-x-auto overflow-y-hidden"
        style={{ width: viewportWidth, maxWidth: "100%", height: geometry.height + SCROLLBAR_RESERVE_PX }}
      >
        <div className="relative" style={{ width: geometry.width, height: geometry.height }}>
          <BracketConnectors
            connectors={geometry.connectors
              .map((c) => ({ ...c, highlighted: isPathConnector(c, involvedMatchIds) }))
              .sort((a, b) => Number(a.highlighted) - Number(b.highlighted))}
            width={geometry.width}
            height={geometry.height}
          />
          {geometry.cards.map(({ match, x, y, width }) => {
            const live = match.outcome === "pending" ? liveByPair.get(pairKey(match.player1Id, match.player2Id)) : undefined;
            const cardData: MatchCardData = live ? { ...match, live } : match;
            return (
              <div key={match.id} className="absolute" style={{ left: x, top: y, width }}>
                <MatchCard
                  data={cardData}
                  width={width}
                  editionId={editionId}
                  tracedPlayerId={selectedId}
                  onTracePlayer={toggleSelected}
                  pathState={selectedId === null ? undefined : involvedMatchIds.has(match.id) ? "on" : "off"}
                />
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: BracketView; onChange: (v: BracketView) => void }) {
  const options: { value: BracketView; label: string }[] = [
    { value: "zoomed", label: "Zoomed" },
    { value: "compact", label: "Compact" },
  ];
  return (
    <div role="group" aria-label="Bracket view" className="flex shrink-0 rounded-full border border-rule p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={view === o.value}
          className={`text-eyebrow rounded-full px-3 py-1 text-[10px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 ${
            view === o.value ? "bg-navy-900 text-white" : "text-muted-label hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
