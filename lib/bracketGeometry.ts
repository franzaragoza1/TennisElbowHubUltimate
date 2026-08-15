import { MATCH_CARD_HEIGHT, MATCH_CARD_WIDTH } from "@/components/tournament/MatchCard";
import type { BracketLayout, BracketMatchInput } from "./bracket";

/** Geometría del cuadro en píxeles — el tamaño de la tarjeta se importa directamente
 * de `MatchCard` para que nunca puedan desincronizarse. `MATCH_CARD_HEIGHT` es una
 * altura MÍNIMA, no fija — un nombre de jugador largo puede partirse en dos líneas
 * (nunca se recorta con "…", ver docs/decisiones.md) y crecer más allá de ella, así
 * que el margen es generoso a propósito para que ese caso raro no se monte encima de
 * la fila de abajo. */
export const CARD_WIDTH = MATCH_CARD_WIDTH;
export const CARD_HEIGHT = MATCH_CARD_HEIGHT;
export const COLUMN_GAP = 72;
export const SLOT_HEIGHT = CARD_HEIGHT + 36;
export const COLUMN_PITCH = CARD_WIDTH + COLUMN_GAP;

export interface PositionedCard<M extends BracketMatchInput> {
  match: M;
  x: number;
  y: number;
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
 */
export function computeWindowGeometry<M extends BracketMatchInput>(
  layout: BracketLayout<M>,
  startIndex: number,
  roundCount: number,
): BracketGeometry<M> {
  const endIndex = Math.min(startIndex + roundCount - 1, layout.roundOrder.length - 1);
  const roundsInWindow = layout.roundOrder.slice(Math.max(0, startIndex), endIndex + 1);

  const localY = new Map<number, number>();
  const cards: PositionedCard<M>[] = [];
  const connectors: ConnectorPath[] = [];
  let maxY = 0;

  roundsInWindow.forEach((round, offset) => {
    const list = layout.matchesByRound.get(round) ?? [];

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

    const x = offset * COLUMN_PITCH;
    for (const pm of list) {
      const y = yToPixels(localY.get(pm.match.id)!);
      cards.push({ match: pm.match, x, y });
      maxY = Math.max(maxY, y + CARD_HEIGHT);

      if (offset === 0) continue; // sus alimentadores quedan fuera de la ventana, no hay línea que trazar
      const targetCenterY = y + CARD_HEIGHT / 2;
      for (const feederId of [pm.player1FeederId, pm.player2FeederId]) {
        if (feederId === null || !localY.has(feederId)) continue;
        const feederY = yToPixels(localY.get(feederId)!);
        const feederRightX = (offset - 1) * COLUMN_PITCH + CARD_WIDTH;
        const feederCenterY = feederY + CARD_HEIGHT / 2;
        const midX = feederRightX + COLUMN_GAP / 2;
        connectors.push({
          d: `M ${feederRightX} ${feederCenterY} H ${midX} V ${targetCenterY} H ${x}`,
        });
      }
    }
  });

  return {
    width: Math.max(0, roundsInWindow.length * COLUMN_PITCH - COLUMN_GAP),
    height: maxY,
    cards,
    connectors,
  };
}
