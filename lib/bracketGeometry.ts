import { MATCH_CARD_HEIGHT, MATCH_CARD_WIDTH } from "@/components/tournament/MatchCard";
import type { BracketLayout, BracketMatchInput } from "./bracket";

/** Geometría del cuadro en píxeles — la altura de la tarjeta se importa directamente
 * de `MatchCard` para que nunca puedan desincronizarse. `MATCH_CARD_HEIGHT` es una
 * altura MÍNIMA, no fija — un nombre de jugador largo puede partirse en dos líneas
 * (nunca se recorta con "…", ver docs/decisiones.md) y crecer más allá de ella, así
 * que el margen es generoso a propósito para que ese caso raro no se monte encima de
 * la fila de abajo.
 *
 * El ANCHO ya no es una constante única: cada ronda tiene el suyo, calculado por
 * quien llama (`BracketColumns`, midiendo el nombre más largo de esa ronda de verdad
 * — ver `MatchCard.tsx::measureRequiredCardWidth`) — pedido explícito: la tarjeta
 * crece dinámicamente en vez de partir el nombre o quedarse corta con un ancho fijo
 * adivinado. `CARD_WIDTH` sigue existiendo como el suelo/valor por defecto. */
export const CARD_WIDTH = MATCH_CARD_WIDTH;
export const CARD_HEIGHT = MATCH_CARD_HEIGHT;
export const COLUMN_GAP = 72;
export const SLOT_HEIGHT = CARD_HEIGHT + 36;
/** Solo para quien todavía necesite un valor único de referencia (nunca se usa para
 * posicionar de verdad, ver `computeWindowGeometry`). */
export const COLUMN_PITCH = CARD_WIDTH + COLUMN_GAP;

export interface PositionedCard<M extends BracketMatchInput> {
  match: M;
  x: number;
  y: number;
  width: number;
}

export interface ConnectorPath {
  d: string;
}

export interface BracketGeometry<M extends BracketMatchInput> {
  width: number;
  height: number;
  cards: PositionedCard<M>[];
  connectors: ConnectorPath[];
}

function yToPixels(y: number): number {
  return y * SLOT_HEIGHT + SLOT_HEIGHT / 2 - CARD_HEIGHT / 2;
}

/**
 * Geometría de SOLO las rondas visibles en la ventana actual (`BracketColumns`), no
 * del cuadro entero — recalculada desde cero para esa ventana, no recortada de un
 * lienzo compartido. La primera ronda visible se numera densa (0,1,2...) EN ESE
 * MOMENTO, sin arrastrar la posición que tuviera en el árbol completo; las rondas
 * siguientes de la ventana se calculan como el promedio de sus alimentadores usando
 * esas posiciones YA RECOMPACTADAS, no las del árbol completo.
 *
 * Por qué: `y` en `buildBracketLayout` (lib/bracket.ts) es la posición real dentro del
 * árbol ENTERO — para una semifinal alimentada por un cuadro de 128, esa `y` puede
 * caer a cientos de píxeles de la otra semifinal, aunque solo queden 2 partidos por
 * enseñar. Recortar y desplazar ese lienzo compartido (como hacía antes) conservaba
 * esa distancia heredada — la ventana de Semifinales terminaba con un hueco vacío
 * enorme entre las dos tarjetas, o entre la tarjeta y el borde, sin nada ahí en medio.
 * Recalcular en local, empezando siempre en 0 para la ronda visible más temprana,
 * hace que la altura de la ventana sea exactamente la que hace falta para las rondas
 * que se están enseñando — nunca más, nunca menos.
 *
 * `cardWidthByRound` da el ancho real de cada ronda (el que le haga falta a su nombre
 * más largo) — las columnas ya no comparten un `COLUMN_PITCH` fijo, cada una ocupa lo
 * que necesite y la siguiente arranca justo después con el hueco de siempre.
 */
export function computeWindowGeometry<M extends BracketMatchInput>(
  layout: BracketLayout<M>,
  startIndex: number,
  roundCount: number,
  cardWidthByRound: Map<string, number>,
): BracketGeometry<M> {
  const endIndex = Math.min(startIndex + roundCount - 1, layout.roundOrder.length - 1);
  const roundsInWindow = layout.roundOrder.slice(Math.max(0, startIndex), endIndex + 1);
  const widthOf = (round: string) => cardWidthByRound.get(round) ?? CARD_WIDTH;

  // x acumulado: cada ronda ocupa su propio ancho real más el hueco fijo entre columnas.
  const xByRound: number[] = [];
  let cursor = 0;
  for (const round of roundsInWindow) {
    xByRound.push(cursor);
    cursor += widthOf(round) + COLUMN_GAP;
  }

  const localY = new Map<number, number>();
  const cards: PositionedCard<M>[] = [];
  const connectors: ConnectorPath[] = [];
  let maxY = 0;

  roundsInWindow.forEach((round, offset) => {
    const list = layout.matchesByRound.get(round) ?? [];
    const width = widthOf(round);

    if (offset === 0) {
      list.forEach((pm, i) => localY.set(pm.match.id, i));
    } else {
      for (const pm of list) {
        const p1 = pm.player1FeederId !== null ? localY.get(pm.player1FeederId) : undefined;
        const p2 = pm.player2FeederId !== null ? localY.get(pm.player2FeederId) : undefined;
        let y: number;
        if (p1 !== undefined && p2 !== undefined) y = (p1 + p2) / 2;
        else if (p1 !== undefined) y = p1;
        else if (p2 !== undefined) y = p2;
        else y = 0;
        localY.set(pm.match.id, y);
      }
    }

    const x = xByRound[offset];
    for (const pm of list) {
      const y = yToPixels(localY.get(pm.match.id)!);
      cards.push({ match: pm.match, x, y, width });
      maxY = Math.max(maxY, y + CARD_HEIGHT);

      if (offset === 0) continue; // sus alimentadores quedan fuera de la ventana, no hay línea que trazar
      const targetCenterY = y + CARD_HEIGHT / 2;
      for (const feederId of [pm.player1FeederId, pm.player2FeederId]) {
        if (feederId === null || !localY.has(feederId)) continue;
        const feederY = yToPixels(localY.get(feederId)!);
        const feederRightX = xByRound[offset - 1] + widthOf(roundsInWindow[offset - 1]);
        const feederCenterY = feederY + CARD_HEIGHT / 2;
        const midX = feederRightX + COLUMN_GAP / 2;
        connectors.push({
          d: `M ${feederRightX} ${feederCenterY} H ${midX} V ${targetCenterY} H ${x}`,
        });
      }
    }
  });

  return {
    width: Math.max(0, cursor - COLUMN_GAP),
    height: maxY,
    cards,
    connectors,
  };
}
