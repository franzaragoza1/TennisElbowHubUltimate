import { fullRoundLadder } from "../bracket";

/**
 * Puntos fijos por ronda, pedidos explícitamente por el propietario — NUNCA se
 * derivan de nada, se copian tal cual. Claves en el vocabulario interno del
 * proyecto (`Q`=cuartos, `S`=semis, `F`=final, `W`=campeón), no las etiquetas
 * ATP (QF/SF/F/W) en las que vinieron especificados — ver lib/roundOrder.ts.
 */
export const FIXED_POINTS_BY_TIER: Record<
  "Grand Slam" | "Masters 1000" | "500" | "250",
  Partial<Record<"R1" | "R2" | "R3" | "R4" | "Q" | "S" | "F" | "W", number>>
> = {
  "Grand Slam": { R1: 10, R2: 50, R3: 100, R4: 200, Q: 400, S: 800, F: 1300, W: 2000 },
  "Masters 1000": { R1: 10, R2: 30, R3: 50, R4: 100, Q: 200, S: 400, F: 650, W: 1000 },
  "500": { R1: 0, R2: 50, Q: 100, S: 200, F: 330, W: 500 },
  "250": { R1: 0, R2: 25, Q: 50, S: 100, F: 165, W: 250 },
};

/** Rondas de clasificación — planas, sin importar el tier, pedido explícito. */
export const QUALIFYING_POINTS: Record<"Q1" | "Q2" | "Q3", number> = { Q1: 0, Q2: 3, Q3: 6 };

export const CHALLENGER_CHAMPION_POINTS: Record<
  "CT 75" | "CT 80" | "CT 90" | "CT 100" | "CT 110" | "CT 125",
  number
> = { "CT 75": 75, "CT 80": 80, "CT 90": 90, "CT 100": 100, "CT 110": 110, "CT 125": 125 };

/** 25 normal, 12 en un cuadro de 8 — pedido explícito, sin más desglose dado. */
export function futureChampionPoints(drawSize: number): number {
  return drawSize === 8 ? 12 : 25;
}

/**
 * Proporción de los puntos de campeón por distancia a la Final (0=F, 1=S, 2=Q,
 * 3=siguiente ronda R hacia atrás, ...) — derivada de que las 4 tablas fijas de
 * arriba comparten EXACTAMENTE este patrón (F≈65% de W, S=40%, Q=20%, y cada ronda
 * más atrás es la mitad de la siguiente: R4/R16=10%, R3/R32=5%, R2/R64=2.5%,
 * R1/R128=1.25%). Ni Challenger ni Future traían un desglose ronda a ronda en el
 * pedido — ASUNCIÓN CONFIRMADA por el propietario: extender esta misma curva,
 * escalada a los puntos de campeón de cada uno (ver docs/decisiones.md).
 */
const RATIO_BY_DISTANCE_FROM_FINAL = [0.65, 0.4, 0.2, 0.1, 0.05, 0.025, 0.0125];

function ratioForDistance(distance: number): number {
  const lastIndex = RATIO_BY_DISTANCE_FROM_FINAL.length - 1;
  if (distance <= lastIndex) return RATIO_BY_DISTANCE_FROM_FINAL[distance];
  // Más allá de la tabla (cuadros enormes, nunca vistos en la práctica): sigue
  // dividiendo entre 2 por cada ronda extra, en vez de devolver 0 sin más.
  return RATIO_BY_DISTANCE_FROM_FINAL[lastIndex] / 2 ** (distance - lastIndex);
}

/**
 * Tabla de puntos por ronda para CUALQUIER escalera de cuadro, escalada a los
 * puntos de campeón dados. `ladder` es `fullRoundLadder(drawSize)` (lib/bracket.ts)
 * — SIN "W", esa columna se añade aparte.
 */
export function buildProportionalPointsTable(ladder: string[], championPoints: number): Record<string, number> {
  const table: Record<string, number> = {};
  ladder.forEach((round, i) => {
    const distance = ladder.length - 1 - i;
    table[round] = Math.round(championPoints * ratioForDistance(distance));
  });
  return table;
}

function isFixedTier(category: string): category is keyof typeof FIXED_POINTS_BY_TIER {
  return category in FIXED_POINTS_BY_TIER;
}

function isChallengerTier(category: string): category is keyof typeof CHALLENGER_CHAMPION_POINTS {
  return category in CHALLENGER_CHAMPION_POINTS;
}

/**
 * Punto de entrada único: puntos por ronda para una edición nativa concreta, SIEMPRE
 * completa (nunca falta una ronda de su propia escalera por no tener clave) —
 * valores fijos donde el tier los especifica, curva proporcional donde no
 * (Challenger/Future, o un cuadro no estándar en un tier con tabla fija: p.ej. una
 * ronda R5 que ningún GS/M1000/500/250 real tiene, pero que no debe devolver 0 por
 * no encajar en la tabla dada).
 */
export function getPointsByRoundForEdition(category: string, drawSize: number): Record<string, number> {
  const ladder = fullRoundLadder(drawSize);
  const fixed = isFixedTier(category) ? FIXED_POINTS_BY_TIER[category] : undefined;
  const championPoints = fixed?.W ?? (isChallengerTier(category) ? CHALLENGER_CHAMPION_POINTS[category] : futureChampionPoints(drawSize));
  const curve = buildProportionalPointsTable(ladder, championPoints);

  const table: Record<string, number> = {};
  for (const round of ladder) {
    table[round] = fixed?.[round as keyof typeof fixed] ?? curve[round];
  }
  table.W = championPoints;
  return table;
}
