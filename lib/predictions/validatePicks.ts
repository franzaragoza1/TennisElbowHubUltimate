/**
 * Nunca se confía en un pick del cliente a ciegas (mismo criterio que
 * `postComment`'s `rootId`, calculado en servidor) — esto repite la MISMA regla de
 * alimentador que dibuja el cuadro real (`lib/bracket.ts`, `2k`/`2k+1`) pero usando los
 * picks de la propia entrega como "ganador" en vez de `matches.winnerId`, salvo en un
 * hueco YA DECIDIDO de verdad (partido real jugado o bye), donde manda el resultado
 * real (`match.winnerId`) sin importar lo que diga (o no diga) el pick — no confiar en
 * el cliente corta en ambos sentidos.
 *
 * Un pick que falta YA NO es un error (pedido explícito del propietario, 2026-09-18):
 * la ronda 1 de este tour se juega a ritmo propio de cada pareja, no toda a la vez, así
 * que una entrega puede llegar con huecos de R1 todavía sin decidir (o en vivo, ver
 * `PredictionBracket`) sin pick ninguno — sencillamente quedan sin resolver, y
 * cualquier pick de ronda posterior que dependiera de ese hueco tampoco se puede
 * validar (se rechaza si se envía uno de todos modos, se ignora si no se envía nada).
 * Lo único que sigue rechazando la entrega es un pick que SÍ se envía pero contradice
 * lo que de verdad puede pasar: un ganador real distinto al de un hueco ya decidido, o
 * un jugador que las picks (o resultados reales) anteriores de esta misma entrega no
 * hacen avanzar hasta ahí.
 */
import type { BracketLayout, BracketMatchInput } from "../bracket";
import type { BracketPick } from "./scoring";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateBracketPicks<M extends BracketMatchInput>(picks: BracketPick[], layout: BracketLayout<M>): ValidationResult {
  const pickByKey = new Map(picks.map((p) => [`${p.round}:${p.slotIndex}`, p.playerId]));
  const advancedByMatchId = new Map<number, number>();

  for (const round of layout.roundOrder) {
    const slots = layout.matchesByRound.get(round) ?? [];
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const { match, player1FeederId, player2FeederId } = slots[slotIndex];
      const pick = pickByKey.get(`${round}:${slotIndex}`);

      if (player1FeederId === null && player2FeederId === null) {
        // Sin alimentador real — el caso normal es R1. Ya decidido de verdad (partido
        // real jugado o bye, ambos con `winnerId` real): manda el resultado, un pick
        // que lo contradiga se rechaza, uno ausente o coincidente no pasa nada.
        if (match.winnerId !== null && match.winnerId > 0) {
          if (pick !== undefined && pick !== match.winnerId) {
            return { valid: false, error: `Pick for ${round} slot ${slotIndex} contradicts the real result` };
          }
          advancedByMatchId.set(match.id, match.winnerId);
          continue;
        }
        // Todavía sin decidir (en vivo o simplemente sin jugar) — un pick es opcional;
        // si llega, tiene que ser de verdad uno de los dos jugadores del cruce.
        if (match.player1Id > 0 && match.player2Id > 0 && pick !== undefined) {
          if (pick !== match.player1Id && pick !== match.player2Id) return { valid: false, error: `Pick for ${round} slot ${slotIndex} isn't one of the two real players in that matchup` };
          advancedByMatchId.set(match.id, pick);
        }
        continue;
      }

      if (pick === undefined) continue; // sin pick para este hueco todavía — nada que validar

      const candidates = [player1FeederId, player2FeederId]
        .map((feederId) => (feederId !== null ? advancedByMatchId.get(feederId) : undefined))
        .filter((id): id is number => id !== undefined);
      if (!candidates.includes(pick)) return { valid: false, error: `Pick for ${round} slot ${slotIndex} isn't one of the players who can actually reach it` };
      advancedByMatchId.set(match.id, pick);
    }
  }

  return { valid: true };
}
