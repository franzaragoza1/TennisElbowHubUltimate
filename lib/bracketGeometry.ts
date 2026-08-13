import { MATCH_CARD_HEIGHT } from "@/components/tournament/MatchCard";
import type { BracketLayout, BracketMatchInput } from "./bracket";

/** Geometría del cuadro en píxeles — la altura de la tarjeta se importa directamente
 * de `MatchCard` para que nunca puedan desincronizarse. */
export const CARD_WIDTH = 224;
export const CARD_HEIGHT = MATCH_CARD_HEIGHT;
export const COLUMN_GAP = 64;
export const SLOT_HEIGHT = 96;
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

/** Convierte el árbol abstracto de `buildBracketLayout` en posiciones de píxel y
 * trazados SVG de los conectores entre rondas. */
export function computeBracketGeometry<M extends BracketMatchInput>(
  layout: BracketLayout<M>,
): BracketGeometry<M> {
  const cards: PositionedCard<M>[] = [];
  const connectors: ConnectorPath[] = [];
  let maxY = 0;

  layout.roundOrder.forEach((round, roundIndex) => {
    const x = roundIndex * COLUMN_PITCH;
    for (const pm of layout.matchesByRound.get(round) ?? []) {
      const y = yToPixels(pm.y);
      cards.push({ match: pm.match, x, y });
      maxY = Math.max(maxY, y + CARD_HEIGHT);

      const targetCenterY = y + CARD_HEIGHT / 2;
      for (const feederId of [pm.player1FeederId, pm.player2FeederId]) {
        if (feederId === null) continue;
        const feeder = layout.positionById.get(feederId);
        if (!feeder) continue;
        const feederRoundIndex = layout.roundOrder.indexOf(feeder.round);
        const feederRightX = feederRoundIndex * COLUMN_PITCH + CARD_WIDTH;
        const feederCenterY = yToPixels(feeder.y) + CARD_HEIGHT / 2;
        const midX = feederRightX + COLUMN_GAP / 2;
        connectors.push({
          d: `M ${feederRightX} ${feederCenterY} H ${midX} V ${targetCenterY} H ${x}`,
        });
      }
    }
  });

  return {
    width: Math.max(0, layout.roundOrder.length * COLUMN_PITCH - COLUMN_GAP),
    height: maxY,
    cards,
    connectors,
  };
}
