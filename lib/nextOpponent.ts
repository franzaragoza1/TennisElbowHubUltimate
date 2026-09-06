/**
 * Estado del "próximo rival" de un jugador con perfil reclamado EN UN TORNEO
 * CONCRETO — pedido explícito: en la propia ficha de torneo en la que el jugador
 * jugó/está jugando, no en `/account`. Cuatro estados reales, nunca se inventa uno
 * intermedio:
 *   - "scheduled": cruce ya emparejado (los dos lados conocidos) en ESTA edición.
 *   - "tbd": ya tiene hueco reservado en el cuadro de esta edición (ganó/tuvo bye en
 *     la ronda anterior) pero el rival todavía no está decidido.
 *   - "champion": sin ningún hueco pendiente, y su partido más reciente fue GANAR la
 *     Final ("F") — quedó campeón del torneo. Pedido explícito ("just in case"): sin
 *     esto, ganar la Final caía en el mismo "none" silencioso que cualquier otro caso
 *     sin actividad, que es justo el único momento en el que SÍ hay algo bueno que
 *     enseñar.
 *   - "eliminated": sin ningún hueco pendiente en esta edición, y su partido más
 *     reciente DENTRO DE ELLA fue una derrota — se enseña quién le ganó.
 *   - "none": el jugador no tiene ninguna actividad en esta edición en absoluto (ni
 *     partido jugado ni hueco pendiente), o ganó su último partido sin que fuera la
 *     Final (dato incompleto/inconsistente — nunca se adivina que eso es ser campeón).
 */
import { and, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editionRoundDeadlines, editions, matches, pendingSlots, players } from "@/db/schema";
import { resolvePlayerLinks } from "@/lib/playerLinks";
import { fullRoundLadder } from "@/lib/bracket";

export interface OpponentInfo {
  playerId: number;
  displayName: string;
  country: string | null;
  character: string | null;
  avatarUrl: string | null;
  websiteProfileUrl: string;
  /** null si el rival no tiene ningún alias de Mana Games registrado (jugador creado
   * a mano desde /account, nunca importado del foro) — no se inventa un enlace. */
  manaProfileUrl: string | null;
  /** null si el rival no tiene cuenta de Discord vinculada. */
  discordProfileUrl: string | null;
}

interface RoundContext {
  round: string;
  /** Para traducir `round` a una etiqueta legible (SF, QF...) con
   * lib/bracket.ts::fullRoundLadder + roundDisplayLabel, igual que hace el cuadro. */
  drawSize: number;
}

export type NextOpponentResult =
  | ({
      status: "scheduled";
      opponent: OpponentInfo;
      /** null si Mana todavía no publica el plazo de esta ronda (recién emparejada, el
       * cuadro no ha llegado a mostrar la fila de plazos para ella todavía) o si el
       * torneo no tiene ninguna fila de plazos en absoluto. */
      deadlineAt: string | null;
    } & RoundContext)
  | ({ status: "tbd" } & RoundContext)
  | ({ status: "champion"; winner: OpponentInfo; runnerUpName: string; scoreRaw: string | null } & RoundContext)
  | ({ status: "eliminated"; opponent: OpponentInfo; scoreRaw: string | null } & RoundContext)
  | { status: "none" };

interface OpponentRowShape {
  opponentId: number;
  opponentDisplayName: string;
  opponentCountry: string | null;
  opponentCharacter: string | null;
  opponentAvatarUrl: string | null;
  opponentLinkedUserId: string | null;
}

async function resolveOpponentInfo(row: OpponentRowShape): Promise<OpponentInfo> {
  const links = await resolvePlayerLinks({ playerId: row.opponentId, linkedUserId: row.opponentLinkedUserId });
  return {
    playerId: row.opponentId,
    displayName: row.opponentDisplayName,
    country: row.opponentCountry,
    character: row.opponentCharacter,
    avatarUrl: row.opponentAvatarUrl,
    websiteProfileUrl: links.websiteProfileUrl,
    manaProfileUrl: links.manaProfileUrl,
    discordProfileUrl: links.discordProfileUrl,
  };
}

interface PendingCandidateRow {
  round: string;
  drawSize: number;
  // null = el otro lado de este hueco todavía es TBD.
  opponentId: number | null;
  opponentDisplayName: string | null;
  opponentCountry: string | null;
  opponentCharacter: string | null;
  opponentAvatarUrl: string | null;
  opponentLinkedUserId: string | null;
  deadlineAt: Date | null;
}

export async function getNextOpponentForPlayer(playerId: number, editionId: number): Promise<NextOpponentResult> {
  const opp = alias(players, "opp");
  // El rival es "el lado que NO es playerId" — un CASE en la condición del join
  // (LEFT, no INNER: el otro lado puede ser NULL de verdad, eso es justo el caso TBD).
  const opponentIdExpr = sql<number | null>`case when ${pendingSlots.player1Id} = ${playerId} then ${pendingSlots.player2Id} else ${pendingSlots.player1Id} end`;

  const candidates: PendingCandidateRow[] = await db
    .select({
      round: pendingSlots.round,
      drawSize: editions.drawSize,
      opponentId: opp.id,
      opponentDisplayName: opp.displayName,
      opponentCountry: sql<string | null>`coalesce(${opp.countryOverride}, ${opp.country})`,
      opponentCharacter: opp.character,
      opponentAvatarUrl: opp.avatarUrl,
      opponentLinkedUserId: opp.linkedUserId,
      deadlineAt: editionRoundDeadlines.deadlineAt,
    })
    .from(pendingSlots)
    .innerJoin(editions, eq(editions.id, pendingSlots.editionId))
    .leftJoin(opp, eq(opp.id, opponentIdExpr))
    .leftJoin(
      editionRoundDeadlines,
      and(eq(editionRoundDeadlines.editionId, pendingSlots.editionId), eq(editionRoundDeadlines.round, pendingSlots.round)),
    )
    .where(
      and(eq(pendingSlots.editionId, editionId), or(eq(pendingSlots.player1Id, playerId), eq(pendingSlots.player2Id, playerId))),
    );

  if (candidates.length > 0) {
    // Un rival ya conocido es siempre estrictamente más información que "TBD". Dentro
    // de una sola edición un jugador solo puede estar esperando en UN hueco a la vez
    // (eliminación directa), así que en la práctica esto es como mucho una fila — el
    // resto es red de seguridad, no un caso real esperado.
    const resolved = candidates.filter(
      (c): c is PendingCandidateRow & { opponentId: number; opponentDisplayName: string } => c.opponentId !== null,
    );
    if (resolved.length > 0) {
      resolved.sort((a, b) => {
        if (a.deadlineAt && b.deadlineAt) return a.deadlineAt.getTime() - b.deadlineAt.getTime();
        if (a.deadlineAt) return -1;
        if (b.deadlineAt) return 1;
        return 0;
      });
      const chosen = resolved[0];
      const opponent = await resolveOpponentInfo({
        opponentId: chosen.opponentId,
        opponentDisplayName: chosen.opponentDisplayName,
        opponentCountry: chosen.opponentCountry,
        opponentCharacter: chosen.opponentCharacter,
        opponentAvatarUrl: chosen.opponentAvatarUrl,
        opponentLinkedUserId: chosen.opponentLinkedUserId,
      });
      return {
        status: "scheduled",
        round: chosen.round,
        drawSize: chosen.drawSize,
        opponent,
        deadlineAt: chosen.deadlineAt ? chosen.deadlineAt.toISOString() : null,
      };
    }

    const tbd = candidates[0];
    return { status: "tbd", round: tbd.round, drawSize: tbd.drawSize };
  }

  // Sin ningún hueco reservado en ESTA edición — si su partido más reciente DENTRO DE
  // ELLA fue una derrota, es que quedó eliminado ahí. "Más reciente" se decide por
  // posición en la escalera de rondas (fullRoundLadder), NUNCA por `matches.id` — un
  // cuadro de 64+ reparte el Main Draw en varias tablas (docs/estructura.md) y la tabla
  // de rondas FINALES se inserta ANTES que la de rondas TEMPRANAS (mismo bug real ya
  // encontrado y arreglado para los plazos, ver docs/decisiones.md 2026-09-05): un
  // cuarto de final perdido puede tener un id de fila MENOR que una ronda anterior
  // ganada, así que `ORDER BY id DESC` devolvía una VICTORIA en vez de la derrota real
  // que en verdad lo eliminó — confirmado con datos reales (Gyrmik, US Open 2026: perdió
  // en Cuartos pero esa fila tiene id 6782, menor que sus rondas 2/3/4 ganadas, 6836-6878).
  const opp2 = alias(players, "opp2");
  const opponentIdExpr2 = sql<number>`case when ${matches.player1Id} = ${playerId} then ${matches.player2Id} else ${matches.player1Id} end`;
  const playerMatches = await db
    .select({
      round: matches.round,
      drawSize: editions.drawSize,
      winnerId: matches.winnerId,
      scoreRaw: matches.scoreRaw,
      opponentId: opp2.id,
      opponentDisplayName: opp2.displayName,
      opponentCountry: sql<string | null>`coalesce(${opp2.countryOverride}, ${opp2.country})`,
      opponentCharacter: opp2.character,
      opponentAvatarUrl: opp2.avatarUrl,
      opponentLinkedUserId: opp2.linkedUserId,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(opp2, eq(opp2.id, opponentIdExpr2))
    .where(and(eq(matches.editionId, editionId), or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId))));

  let lastMatch = playerMatches[0];
  if (playerMatches.length > 1) {
    const ladder = fullRoundLadder(playerMatches[0].drawSize);
    lastMatch = [...playerMatches].sort((a, b) => ladder.indexOf(b.round) - ladder.indexOf(a.round))[0];
  }

  if (lastMatch && lastMatch.winnerId !== playerId) {
    const opponent = await resolveOpponentInfo({
      opponentId: lastMatch.opponentId,
      opponentDisplayName: lastMatch.opponentDisplayName,
      opponentCountry: lastMatch.opponentCountry,
      opponentCharacter: lastMatch.opponentCharacter,
      opponentAvatarUrl: lastMatch.opponentAvatarUrl,
      opponentLinkedUserId: lastMatch.opponentLinkedUserId,
    });
    return {
      status: "eliminated",
      round: lastMatch.round,
      drawSize: lastMatch.drawSize,
      opponent,
      scoreRaw: lastMatch.scoreRaw,
    };
  }

  // Ganó su último partido sin ningún hueco pendiente después — solo significa
  // "campeón" si ese partido fue la Final ("F", igual que en el resto del sitio, ver
  // lib/bracket.ts). Ganar una ronda ANTERIOR sin hueco pendiente sería un dato
  // incompleto/inconsistente (en una eliminación directa real siempre habría un hueco
  // para la siguiente ronda) — nunca se adivina que eso también es ser campeón.
  if (lastMatch && lastMatch.winnerId === playerId && lastMatch.round === "F") {
    // El foco de la tarjeta de campeón es EL PROPIO GANADOR (pedido explícito: "should
    // show the winner, not the opponent") — el rival de la Final solo se menciona como
    // texto de contexto ("defeated X, 6/4 7/6"), nunca como la ficha protagonista.
    const [self] = await db
      .select({
        id: players.id,
        displayName: players.displayName,
        country: sql<string | null>`coalesce(${players.countryOverride}, ${players.country})`,
        character: players.character,
        avatarUrl: players.avatarUrl,
        linkedUserId: players.linkedUserId,
      })
      .from(players)
      .where(eq(players.id, playerId));
    const winner = await resolveOpponentInfo({
      opponentId: self.id,
      opponentDisplayName: self.displayName,
      opponentCountry: self.country,
      opponentCharacter: self.character,
      opponentAvatarUrl: self.avatarUrl,
      opponentLinkedUserId: self.linkedUserId,
    });
    return {
      status: "champion",
      round: lastMatch.round,
      drawSize: lastMatch.drawSize,
      winner,
      runnerUpName: lastMatch.opponentDisplayName,
      scoreRaw: lastMatch.scoreRaw,
    };
  }

  return { status: "none" };
}
