/**
 * Reconstrucción del árbol del cuadro a partir de los partidos planos que ya tenemos
 * en `matches` — no hay ningún dato de posición almacenado, así que se deduce
 * emparejando el `winnerId` de una ronda con el `player1Id`/`player2Id` de la
 * siguiente (verificado a mano contra datos reales, ver plan de esta fase).
 */

const ROUND_PRIORITY = ["R1", "R2", "R3", "R4", "R5", "R6", "Q", "S", "F"];

export interface BracketMatchInput {
  id: number;
  round: string;
  player1Id: number;
  player2Id: number;
  /** null = cruce todavía sin decidir (ver `TBD_PLAYER_ID` en MatchCard.tsx) — nunca
   * alimenta a nadie, la búsqueda de alimentador (`m.winnerId === playerId`) nunca
   * puede casar con un `playerId` real, así que no hace falta tratarlo aparte. */
  winnerId: number | null;
  /** Posición real, de arriba abajo, dentro de SU RONDA en la rejilla fuente (ver
   * parsers/schemas.ts::MatchSchema.sortIndex) — de dónde sale el orden verdadero de
   * un partido o bye que no se pueda alcanzar por alimentador real (ver comentario de
   * `buildBracketLayout` más abajo). */
  sortIndex: number;
}

export interface PositionedMatch<M extends BracketMatchInput = BracketMatchInput> {
  match: M;
  round: string;
  y: number;
  /** id del partido de la ronda anterior cuyo ganador es player1, o null si no hay (bye / primera ronda). */
  player1FeederId: number | null;
  player2FeederId: number | null;
}

export interface BracketLayout<M extends BracketMatchInput = BracketMatchInput> {
  roundOrder: string[];
  matchesByRound: Map<string, PositionedMatch<M>[]>;
  positionById: Map<number, PositionedMatch<M>>;
}

export function determineRoundOrder(matches: BracketMatchInput[]): string[] {
  const present = new Set(matches.map((m) => m.round));
  return ROUND_PRIORITY.filter((r) => present.has(r));
}

/**
 * Reconstruye el orden real, de arriba abajo, de cada ronda combinando dos cosas: el
 * orden verdadero dentro de cada ronda (`sortIndex`, posición real en la rejilla
 * fuente — ya no hay que adivinar nada) y la relación de alimentador entre rondas
 * (`winnerId`, para saber qué dos tarjetas de una ronda dan Y de qué tarjeta de la
 * siguiente, y así poder dibujar los conectores centrados entre sus dos alimentadores).
 *
 * Antes (antes de que el parser capturase byes reales con su `sortIndex`) esto se
 * reconstruía expandiendo hacia atrás desde la última ronda con partidos, asumiendo
 * que cualquier partido no alcanzable así era una anomalía rara. Esa asunción se rompe
 * en un torneo a medio jugar (Cincinnati 2026, Trn=2092): con solo 1 partido decidido
 * en la última ronda con datos, CASI TODO el resto de rondas caía en la rama de
 * "anomalía", y esa rama ordenaba por `id` — un orden de inserción global, no la
 * posición real dentro de la ronda — mezclando entrantes de un extremo del cuadro con
 * el otro. `sortIndex` no tiene ese problema: es la posición real dentro de SU ronda,
 * disponible siempre, jugado el partido o no.
 */
export function buildBracketLayout<M extends BracketMatchInput>(matches: M[]): BracketLayout<M> {
  const roundOrder = determineRoundOrder(matches);
  const matchesByRoundRaw = new Map<string, M[]>();
  for (const round of roundOrder) {
    matchesByRoundRaw.set(
      round,
      matches.filter((m) => m.round === round).sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id),
    );
  }

  const feederIds = new Map<number, { player1FeederId: number | null; player2FeederId: number | null }>();
  const orderedByRound = new Map<string, M[]>();

  if (roundOrder.length > 0) {
    const lastRound = roundOrder[roundOrder.length - 1];
    orderedByRound.set(lastRound, [...(matchesByRoundRaw.get(lastRound) ?? [])]);

    for (let i = roundOrder.length - 2; i >= 0; i--) {
      const round = roundOrder[i];
      const nextOrdered = orderedByRound.get(roundOrder[i + 1]) ?? [];
      const roundRaw = matchesByRoundRaw.get(round) ?? [];
      const placed = new Set<number>();

      // Este paso solo busca la relación de ALIMENTADOR (para los conectores y la
      // media de Y) — el orden final de la ronda no sale de aquí. Antes sí salía: los
      // partidos alcanzados desde la ronda siguiente se colocaban primero, y los que no
      // se alcanzaban ("anomalía") se añadían al final — funcionaba mientras lo
      // "anómalo" fuera la excepción, pero en un torneo a medias (Cincinnati 2026,
      // Trn=2092) con una última ronda casi vacía, CASI TODO cae en esa rama, y
      // agruparlo al final mezclaba entrantes de un extremo del cuadro con el otro.
      nextOrdered.forEach((nextMatch, indexInNextRound) => {
        const feeders: (number | null)[] = [];
        for (const playerId of [nextMatch.player1Id, nextMatch.player2Id]) {
          const feeder = roundRaw.find((m) => m.winnerId === playerId && !placed.has(m.id));
          if (feeder) {
            placed.add(feeder.id);
            feeders.push(feeder.id);
          } else {
            feeders.push(null);
          }
        }
        // Nadie ha ganado todavía (cruce pendiente o "TBD") así que la búsqueda por
        // `winnerId` no puede encontrar nada — pero la POSICIÓN sí se sabe: el hueco K
        // de esta ronda sale siempre de los huecos 2K y 2K+1 de la ronda anterior (la
        // misma rejilla física; `pending` ya no deja huecos sin capturar, así que
        // `roundRaw` está completo y esta correspondencia es exacta, no una suposición).
        // Sin esto, un tramo entero del cuadro sin decidir se quedaba sin conector
        // alguno, como si esas tarjetas "TBD" flotaran sueltas.
        if (feeders[0] === null) feeders[0] = roundRaw[indexInNextRound * 2]?.id ?? null;
        if (feeders[1] === null) feeders[1] = roundRaw[indexInNextRound * 2 + 1]?.id ?? null;
        feederIds.set(nextMatch.id, { player1FeederId: feeders[0], player2FeederId: feeders[1] });
      });
      // El orden real de la ronda es siempre `sortIndex` (ya viene ordenado en
      // `roundRaw`), se haya alcanzado el partido desde la ronda siguiente o no.
      orderedByRound.set(round, roundRaw);
    }
  }

  const positioned = new Map<number, PositionedMatch<M>>();
  for (const round of roundOrder) {
    const ordered = orderedByRound.get(round) ?? [];
    ordered.forEach((match, indexInRound) => {
      const feeders = feederIds.get(match.id);
      const p1y = feeders?.player1FeederId !== null && feeders?.player1FeederId !== undefined
        ? positioned.get(feeders.player1FeederId)?.y
        : undefined;
      const p2y = feeders?.player2FeederId !== null && feeders?.player2FeederId !== undefined
        ? positioned.get(feeders.player2FeederId)?.y
        : undefined;
      // La primera ronda (o cualquier partido sin ningún alimentador real) se numera
      // 0,1,2... en su propio orden ya reconstruido; el resto es la media de sus dos
      // alimentadores, cayendo exactamente entre ellos.
      let y: number;
      if (p1y !== undefined && p2y !== undefined) y = (p1y + p2y) / 2;
      else if (p1y !== undefined) y = p1y;
      else if (p2y !== undefined) y = p2y;
      else y = indexInRound;

      positioned.set(match.id, {
        match,
        round: match.round,
        y,
        player1FeederId: feeders?.player1FeederId ?? null,
        player2FeederId: feeders?.player2FeederId ?? null,
      });
    });
  }

  // El orden final es el de `orderedByRound` (sortIndex, siempre correcto) — SIN
  // reordenar por `.y`. `.y` es un valor informativo (media de alimentadores, o
  // posición de respaldo si no tiene ninguno) que no tiene por qué caer en una escala
  // consistente entre partidos alcanzados y no alcanzados dentro de la misma ronda;
  // reordenar por él podía intercalar mal un partido sin alimentador entre dos que sí
  // lo tenían. Quien consume esto (`lib/bracketGeometry.ts`) ya recalcula su propia
  // posición en píxeles a partir del ORDEN de esta lista, no de `.y` directamente.
  const matchesByRound = new Map<string, PositionedMatch<M>[]>();
  for (const round of roundOrder) {
    const list = (orderedByRound.get(round) ?? []).map((m) => positioned.get(m.id)!);
    matchesByRound.set(round, list);
  }

  return { roundOrder, matchesByRound, positionById: positioned };
}

/**
 * La escalera COMPLETA de rondas que va a usar este cuadro, a partir del tamaño del
 * draw — no de qué rondas ya tienen partidos decididos. Hace falta esta distinción
 * para `roundDisplayLabel`: un torneo a medias (p. ej. solo R1-R4 ya jugados, Q/S/F
 * todavía sin decidir) tiene `determineRoundOrder(matches)` == ["R1","R2","R3","R4"],
 * y contar posiciones DESDE EL FINAL de esa lista mal etiqueta R4 como "F" (es el
 * último con datos, no la Final de verdad) — bug real, visto con Cincinnati 2026
 * (Trn=2092, draw de 96, "Ongoing"): R1 salía como "R16", R4 como "F".
 *
 * Mana Games redondea el draw a la siguiente potencia de 2 para decidir cuántas
 * rondas `R` preceden a `Q` — confirmado contra los 5 tamaños vistos hasta ahora
 * (docs/estructura.md §3 + Cincinnati): 8→0 rondas R (Q,S,F,W directo), 16→1, 32→2,
 * 64→3, 96→4 (se comporta como un cuadro de 128). Si algún día aparece un tamaño que
 * no siga este patrón, esto mal-etiqueta los chips (no corrompe ningún dato importado,
 * `matches` no depende de esta función) — revisar entonces.
 */
export function fullRoundLadder(drawSize: number): string[] {
  const bracketSlots = 2 ** Math.ceil(Math.log2(Math.max(drawSize, 1)));
  const rRoundCount = Math.max(0, Math.round(Math.log2(bracketSlots)) - 3);
  const rRounds = Array.from({ length: rRoundCount }, (_, i) => `R${i + 1}`);
  return [...rRounds, "Q", "S", "F"];
}

/**
 * Etiqueta de ronda "de toda la vida" (R32, R16, QF, SF, F) calculada por posición
 * desde la Final, no por el código interno — así se lee igual sin importar cuántas
 * rondas `R` tenga ese cuadro en concreto. El array que se le pase tiene que ser la
 * escalera COMPLETA del cuadro (`fullRoundLadder`), no solo las rondas con partidos
 * decididos — ver el aviso de `fullRoundLadder` de arriba.
 */
export function roundDisplayLabel(roundOrder: string[], round: string): string {
  const idx = roundOrder.indexOf(round);
  if (idx === -1) return round;
  const fromEnd = roundOrder.length - 1 - idx;
  if (fromEnd === 0) return "F";
  if (fromEnd === 1) return "SF";
  if (fromEnd === 2) return "QF";
  return `R${2 ** (fromEnd + 1)}`;
}
