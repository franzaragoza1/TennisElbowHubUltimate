/**
 * Los 4 nombres "de cartel" de una entrega de predicción — campeón, el otro finalista
 * (a quien se predice que PIERDE la final) y los dos semifinalistas perdedores — y
 * hasta dónde llegó DE VERDAD cada uno en el cuadro real. Pedido explícito del
 * propietario (2026-09-18), calcado de una tabla de referencia real de otro sitio de
 * predicciones: la clasificación de cada torneo enseña estos 4 nombres por fila, cada
 * uno en verde si acertó la categoría EXACTA que se le pedía (el campeón de verdad
 * ganó, el finalista de verdad perdió la final, cada semifinalista de verdad perdió su
 * semifinal) o en rojo con la ronda real en la que quedó eliminado si no.
 */
import type { BracketLayout, BracketMatchInput } from "../bracket";
import type { BracketPick } from "./scoring";

interface ResolvedSlot {
  candidate1Id: number | null;
  candidate2Id: number | null;
  winnerId: number | null;
}

/**
 * Reconstruye el cuadro COMPLETO que una entrega concreta implica — quién avanza en
 * cada hueco según sus PROPIOS picks (el resultado real solo entra como respaldo para
 * un hueco sin pick posible, p.ej. un bye), cascada arriba, misma regla 2k/2k+1 que
 * lib/bracket.ts, pero guardando los DOS candidatos de cada hueco (no solo el ganador)
 * — hace falta saber quién es "el otro" para extraer el finalista/semifinalistas
 * implícitos (nunca elegidos directamente: solo se pica un ganador por hueco).
 */
export function resolveSubmissionBracket<M extends BracketMatchInput>(picks: BracketPick[], layout: BracketLayout<M>): Map<number, ResolvedSlot> {
  const pickByKey = new Map(picks.map((p) => [`${p.round}:${p.slotIndex}`, p.playerId]));
  const result = new Map<number, ResolvedSlot>();

  for (const round of layout.roundOrder) {
    const slots = layout.matchesByRound.get(round) ?? [];
    slots.forEach((positioned, slotIndex) => {
      const { match, player1FeederId, player2FeederId } = positioned;
      let candidate1Id: number | null;
      let candidate2Id: number | null;

      if (player1FeederId === null && player2FeederId === null) {
        candidate1Id = match.player1Id > 0 ? match.player1Id : null;
        candidate2Id = match.player2Id > 0 ? match.player2Id : null;
      } else {
        candidate1Id = player1FeederId !== null ? (result.get(player1FeederId)?.winnerId ?? null) : null;
        candidate2Id = player2FeederId !== null ? (result.get(player2FeederId)?.winnerId ?? null) : null;
      }

      // La entrega se rellena entera de una sentada ANTES de que exista ningún resultado
      // real (el bloqueo llega con el primer resultado real o el deadline, lo que pase
      // antes) — así que el propio pick es SIEMPRE la fuente de verdad de "qué predijo
      // esta entrega para este hueco", incluso después de que el resultado real acabe
      // contradiciéndolo. Bug real corregido, 2026-09-18: con la prioridad al revés (el
      // resultado real manda en cuanto existe) el cartel de TODAS las entregas convergía
      // al resultado real en cuanto el torneo terminaba, sin importar qué hubiera picado
      // cada quien — la clasificación dejaba de tener sentido justo cuando más se mira.
      // Solo cae al resultado real cuando no hay pick posible de entrada: un bye (nunca
      // se pica) o, por robustez, un hueco que la entrega no llegó a cubrir.
      const pick = pickByKey.get(`${round}:${slotIndex}`);
      let winnerId: number | null;
      if (pick !== undefined && (pick === candidate1Id || pick === candidate2Id)) {
        winnerId = pick;
      } else if (match.winnerId !== null && match.winnerId > 0) {
        winnerId = match.winnerId;
      } else {
        winnerId = null;
      }

      result.set(match.id, { candidate1Id, candidate2Id, winnerId });
    });
  }
  return result;
}

export interface MarqueePicks {
  championId: number | null;
  finalistId: number | null;
  semifinalist1Id: number | null;
  semifinalist2Id: number | null;
}

/**
 * Solo mira las dos ÚLTIMAS rondas del cuadro (F y sus dos alimentadoras) — funciona
 * igual sin importar cuántas rondas tempranas tenga el cuadro completo. Cualquier
 * campo puede salir `null` (entrega incompleta, o un cuadro demasiado pequeño para
 * tener semifinales de verdad).
 */
export function extractMarqueePicks<M extends BracketMatchInput>(picks: BracketPick[], layout: BracketLayout<M>): MarqueePicks {
  const empty: MarqueePicks = { championId: null, finalistId: null, semifinalist1Id: null, semifinalist2Id: null };
  if (layout.roundOrder.length === 0) return empty;

  const resolved = resolveSubmissionBracket(picks, layout);
  const lastRound = layout.roundOrder[layout.roundOrder.length - 1];
  const fSlot = (layout.matchesByRound.get(lastRound) ?? [])[0];
  if (!fSlot) return empty;

  const fResolved = resolved.get(fSlot.match.id);
  // `winnerId === null` significa que ese hueco todavía no tiene NADA decidido (ni
  // resultado real ni pick propio) — ahí no hay "el otro candidato" que valga, los dos
  // siguen igual de indeterminados (bug real corregido, 2026-09-18: sin este guard,
  // `candidate1Id === null` salía `true` cuando NINGUNO de los dos estaba resuelto
  // todavía, y el código devolvía el otro candidato como si hubiera "perdido" un hueco
  // que en realidad nunca llegó a resolverse).
  const championId = fResolved?.winnerId ?? null;
  const finalistId = fResolved && fResolved.winnerId !== null ? (fResolved.candidate1Id === championId ? fResolved.candidate2Id : fResolved.candidate1Id) : null;

  const semiFeederIds = [fSlot.player1FeederId, fSlot.player2FeederId].filter((id): id is number => id !== null);
  const semifinalistIds = semiFeederIds.map((matchId) => {
    const r = resolved.get(matchId);
    if (!r || r.winnerId === null) return null;
    return r.candidate1Id === r.winnerId ? r.candidate2Id : r.candidate1Id;
  });

  return {
    championId,
    finalistId,
    semifinalist1Id: semifinalistIds[0] ?? null,
    semifinalist2Id: semifinalistIds[1] ?? null,
  };
}

export type ExitRound = { kind: "champion" } | { kind: "eliminated"; round: string } | { kind: "alive" } | null;

/**
 * Hasta dónde llegó DE VERDAD un jugador en el cuadro real, a partir SOLO de partidos
 * ya decididos — nunca de un hueco `pending`. `null` = no aparece en ningún partido
 * decidido de este cuadro todavía (ni siquiera ha empezado a jugar).
 */
export function getPlayerExitRound<M extends BracketMatchInput>(layout: BracketLayout<M>, playerId: number | null): ExitRound {
  if (playerId === null || layout.roundOrder.length === 0) return null;
  const lastRound = layout.roundOrder[layout.roundOrder.length - 1];
  let eliminatedAt: string | null = null;
  let wonLastRound = false;
  let everPlayed = false;

  for (const round of layout.roundOrder) {
    for (const positioned of layout.matchesByRound.get(round) ?? []) {
      const { match } = positioned;
      if (match.winnerId === null || match.winnerId <= 0) continue;
      if (match.player1Id !== playerId && match.player2Id !== playerId) continue;
      everPlayed = true;
      if (match.winnerId === playerId) {
        if (round === lastRound) wonLastRound = true;
      } else {
        eliminatedAt = round;
      }
    }
  }

  if (eliminatedAt !== null) return { kind: "eliminated", round: eliminatedAt };
  if (wonLastRound) return { kind: "champion" };
  if (everPlayed) return { kind: "alive" };
  return null;
}
