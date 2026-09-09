/**
 * Anuncia un resultado en cuanto aparece en `recent_results` — pedido explícito del
 * propietario, tras dos intentos fallidos con `matches` como fuente (ventana de días
 * demasiado corta = partidos de verdad descartados para siempre; sin ventana =
 * reventó el canal con partidos de 2021; "torneo en juego" calculado a mano = seguía
 * colando finales históricas nunca antes anunciadas): `matches` guarda TODO el
 * archivo desde 2021 sin ningún límite natural, así que cualquier regla propia sobre
 * esa tabla puede acabar abriendo la puerta al histórico entero por algún borde no
 * previsto.
 *
 * `recent_results` (lib/mana/loadRecentResults.ts, la misma fuente que alimenta
 * `/scores`) resuelve "¿es esto de verdad reciente?" — viene de `OT_LastResults.php`,
 * una página que la propia Mana Games mantiene como una ventana rodante de ~10 días,
 * así que nunca puede traer partidos de 2021. Pero "reportado hace poco" y "el torneo
 * sigue en juego" son dos cosas distintas — bug real reportado: el US Open ya tenía su
 * final decidida (torneo terminado) pero sus rondas tempranas seguían apareciendo en
 * `recent_results` (se reportaron tarde) y se habrían anunciado igual, mucho después
 * de que el propio campeón ya se hubiera anunciado. La segunda condición de más abajo
 * añade justo eso: la edición no puede tener YA una final decidida por OTRO partido
 * (`otherMatches.id <> matches.id`, para que la final de verdad de esa edición no se
 * bloquee a sí misma) — mismo criterio que `lib/tournamentStatus.ts::
 * deriveTournamentStatus` (ronda 'F' decidida = torneo terminado), aplicado aquí en
 * SQL en vez de traer todos los partidos de la edición para calcularlo en JS. Entre
 * las dos condiciones: solo se anuncia un partido reportado hace poco (`recent_
 * results`) de un torneo que O sigue en juego, O es la propia final que lo decide.
 *
 * El contenido real del anuncio (marcador, IDs de jugador en orden de cuadro,
 * `outcome`...) sigue viniendo de `matches`, la fuente de verdad de siempre — se
 * cruza con `recent_results` por (editionId, round, el par ganador/perdedor en
 * cualquier orden).
 *
 * Clave de dedup: `(editionId, round, player1Id, player2Id)` de `matches` — mismo
 * motivo que `announceMatchups.ts`: `matches` se borra y se reinserta entera en cada
 * recarga del torneo, así que `matches.id` no es una identidad estable para "¿ya lo
 * publiqué?". Un resultado de `recent_results` sin `editionId` resuelto (Trn nuevo que
 * el propio scraper de torneos todavía no ha visto) simplemente no cruza con ningún
 * `matches` y no se anuncia todavía — el próximo ciclo, ya con la edición cargada, sí.
 *
 * `MAX_RESULTS_PER_CYCLE` es una red de seguridad aparte: como mucho ese número de
 * resultados por pasada, los más antiguos sin publicar primero. Bug real reportado:
 * un backlog legítimo (varios partidos reales de un torneo en juego, nunca antes
 * anunciados) SÍ pasaba el filtro de arriba correctamente, pero se mandaban todos
 * seguidos en el mismo bucle sin ninguna pausa entre mensajes — Discord recibía una
 * ráfaga de N mensajes en segundos, exactamente el aspecto de spam que se quería
 * evitar, aunque el CONTENIDO fuera correcto. `RESULT_SPACING_MS` espacia cada envío
 * (mismo motivo que `GROQ_CALL_SPACING_MS` en lib/matchLog/suggestNameMatches.ts: una
 * ráfaga se siente distinto a la misma cantidad de mensajes repartida en el tiempo),
 * y el tope en sí baja de 20 a 5 para que ni siquiera espaciados se note como un muro
 * de mensajes de golpe — el resto del backlog, si lo hay, sale en las siguientes
 * pasadas (`POLL_INTERVAL_MS`, scripts/discordBot.ts).
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";
import { and, asc, eq, isNotNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordMatchResultPosts, discordMatchupThreads, editions, events, matches, players, recentResults } from "@/db/schema";
import { resolvePlayerLinks } from "@/lib/playerLinks";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { mentionOrBold } from "../mentions";
import { discordClient } from "../client";
import { discordBotConfig } from "../config";

const MAX_RESULTS_PER_CYCLE = 5;
const RESULT_SPACING_MS = 4000;

interface FinishedMatchRow {
  editionId: number;
  round: string;
  drawSize: number;
  eventName: string;
  year: number;
  scoreRaw: string | null;
  outcome: string;
  player1Id: number;
  player1Name: string;
  player1LinkedUserId: string | null;
  player2Id: number;
  player2Name: string;
  player2LinkedUserId: string | null;
  winnerId: number | null;
}

async function findUnannouncedResults(): Promise<FinishedMatchRow[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const otherMatches = alias(matches, "other_matches");

  // Se pide un margen por encima de MAX_RESULTS_PER_CYCLE: más de una fila de
  // `recent_results` puede apuntar al MISMO `matches` (reportado dos veces a horas
  // distintas) y se deduplica en JS más abajo — sin margen, esas repeticiones podrían
  // desplazar resultados de verdad fuera del tope antes de deduplicar.
  const rows = await db
    .select({
      editionId: matches.editionId,
      round: matches.round,
      drawSize: editions.drawSize,
      eventName: events.displayName,
      year: editions.year,
      scoreRaw: matches.scoreRaw,
      outcome: matches.outcome,
      player1Id: p1.id,
      player1Name: p1.displayName,
      player1LinkedUserId: p1.linkedUserId,
      player2Id: p2.id,
      player2Name: p2.displayName,
      player2LinkedUserId: p2.linkedUserId,
      winnerId: matches.winnerId,
      reportedAt: recentResults.reportedAt,
    })
    .from(recentResults)
    .innerJoin(
      matches,
      and(
        eq(matches.editionId, recentResults.editionId),
        eq(matches.round, recentResults.round),
        or(
          and(eq(matches.player1Id, recentResults.winnerId), eq(matches.player2Id, recentResults.loserId)),
          and(eq(matches.player1Id, recentResults.loserId), eq(matches.player2Id, recentResults.winnerId)),
        ),
      ),
    )
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(
      and(
        isNotNull(matches.winnerId),
        // El torneo sigue en juego (esta edición no tiene TODAVÍA una final decidida
        // por OTRO partido), o este partido ES esa final. Ver el comentario de arriba.
        notExists(
          db
            .select({ one: sql`1` })
            .from(otherMatches)
            .where(
              and(
                eq(otherMatches.editionId, matches.editionId),
                eq(otherMatches.round, "F"),
                isNotNull(otherMatches.winnerId),
                sql`${otherMatches.id} <> ${matches.id}`,
              ),
            ),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(discordMatchResultPosts)
            .where(
              and(
                eq(discordMatchResultPosts.editionId, matches.editionId),
                eq(discordMatchResultPosts.round, matches.round),
                eq(discordMatchResultPosts.player1Id, matches.player1Id),
                eq(discordMatchResultPosts.player2Id, matches.player2Id),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(recentResults.reportedAt))
    .limit(MAX_RESULTS_PER_CYCLE * 3);

  const seen = new Set<string>();
  const deduped: FinishedMatchRow[] = [];
  for (const row of rows) {
    const key = `${row.editionId}:${row.round}:${row.player1Id}:${row.player2Id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      editionId: row.editionId,
      round: row.round,
      drawSize: row.drawSize,
      eventName: row.eventName,
      year: row.year,
      scoreRaw: row.scoreRaw,
      outcome: row.outcome,
      player1Id: row.player1Id,
      player1Name: row.player1Name,
      player1LinkedUserId: row.player1LinkedUserId,
      player2Id: row.player2Id,
      player2Name: row.player2Name,
      player2LinkedUserId: row.player2LinkedUserId,
      winnerId: row.winnerId,
    });
    if (deduped.length >= MAX_RESULTS_PER_CYCLE) break;
  }
  return deduped;
}

async function announceOneResult(row: FinishedMatchRow): Promise<void> {
  const channel = await discordClient.channels.fetch(discordBotConfig.resultsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const [links1, links2] = await Promise.all([
    resolvePlayerLinks({ playerId: row.player1Id, linkedUserId: row.player1LinkedUserId }),
    resolvePlayerLinks({ playerId: row.player2Id, linkedUserId: row.player2LinkedUserId }),
  ]);

  const roundLabel = roundDisplayLabel(fullRoundLadder(row.drawSize), row.round);
  const winnerIsPlayer1 = row.winnerId === row.player1Id;
  const winnerName = winnerIsPlayer1 ? row.player1Name : row.player2Name;
  const loserName = winnerIsPlayer1 ? row.player2Name : row.player1Name;
  const winnerDiscordId = winnerIsPlayer1 ? links1.discordUserId : links2.discordUserId;
  const loserDiscordId = winnerIsPlayer1 ? links2.discordUserId : links1.discordUserId;
  const headline = `${row.eventName} ${row.year} ${roundLabel}: **${winnerName}** d. ${loserName} ${row.scoreRaw ?? `(${row.outcome})`}`;

  const embed = new EmbedBuilder().setColor(0x0057b8).setTitle(headline).setDescription("Want to give your take on this one? Press the button below to start a short interview.");

  // Pedido explícito: los jugadores con Discord vinculado tienen que recibir una
  // notificación de verdad — mismo motivo que announceMatchups.ts, un mention DENTRO
  // del embed no pinga a nadie, solo el del `content` del propio mensaje sí. Bug real
  // reportado: el resultado se publicaba sin pings de ningún tipo.
  const content = `${mentionOrBold(winnerName, winnerDiscordId)} d. ${mentionOrBold(loserName, loserDiscordId)}`;

  // Igual que en announceMatchups.ts: el mensaje se publica ANTES de guardar el
  // seguimiento — si el insert fallara después de publicar, el próximo ciclo
  // simplemente lo reintenta (nunca al revés, o quedaría "ya publicado" sin mensaje).
  const message = await channel.send({ content, embeds: [embed] });

  const interviewRow = new ActionRowBuilder<ButtonBuilder>();
  if (links1.discordUserId) {
    interviewRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`interview:${row.editionId}:${row.round}:${row.player1Id}:${row.player2Id}`)
        .setLabel(`Interview me — ${row.player1Name}`)
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (links2.discordUserId) {
    interviewRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`interview:${row.editionId}:${row.round}:${row.player2Id}:${row.player1Id}`)
        .setLabel(`Interview me — ${row.player2Name}`)
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (interviewRow.components.length > 0) {
    await message.edit({ embeds: [embed], components: [interviewRow] });
  }

  await db.insert(discordMatchResultPosts).values({
    editionId: row.editionId,
    round: row.round,
    player1Id: row.player1Id,
    player2Id: row.player2Id,
    messageId: message.id,
    channelId: channel.id,
  });

  // Aparte del resto de esta función a propósito: el resultado ya se publicó y ya
  // quedó registrado en discordMatchResultPosts, así que un fallo cerrando el hilo
  // (ya archivado, hilo borrado, permisos...) nunca debe volver a intentarse en el
  // siguiente ciclo ni, mucho menos, hacer que se re-publique el mismo resultado —
  // mismo criterio que el aviso extra de /extend (commands/extend.ts).
  try {
    await closeMatchupThread(row);
  } catch (err) {
    console.error(`✗ No se pudo cerrar el hilo de organización de ${row.eventName} ${row.round} (${row.player1Name} vs ${row.player2Name}):`, err);
  }
}

/**
 * Cierra el hilo de "organiza tu partido" (announceMatchups.ts) en cuanto el partido
 * ya tiene resultado — pedido explícito: nadie necesita seguir coordinando un partido
 * que ya se jugó. Se busca por la misma clave de dedup que el resto de este archivo
 * (editionId, round, player1Id, player2Id) — nunca por `pending_slots.id`, que no es
 * estable.
 */
async function closeMatchupThread(row: FinishedMatchRow): Promise<void> {
  const [tracking] = await db
    .select({ threadId: discordMatchupThreads.threadId })
    .from(discordMatchupThreads)
    .where(
      and(
        eq(discordMatchupThreads.editionId, row.editionId),
        eq(discordMatchupThreads.round, row.round),
        eq(discordMatchupThreads.player1Id, row.player1Id),
        eq(discordMatchupThreads.player2Id, row.player2Id),
      ),
    );
  if (!tracking) return;

  const thread = await discordClient.channels.fetch(tracking.threadId);
  if (!thread?.isThread() || thread.archived) return;

  await thread.send("Match finished — see the result in the results channel. Closing this thread.");
  // Bloqueado ANTES de archivado a propósito: un hilo archivado pero sin bloquear se
  // reabre solo en cuanto alguien manda un mensaje nuevo — bloquearlo primero es lo
  // que de verdad lo deja cerrado.
  await thread.setLocked(true);
  await thread.setArchived(true);
}

export async function announceResults(): Promise<void> {
  const rows = await findUnannouncedResults();
  let announcedOnce = false;
  for (const row of rows) {
    // Espaciado entre envíos, no entre intentos — un fallo (try/catch de abajo) no
    // debe comerse igualmente su hueco de tiempo si no llegó a publicar nada.
    if (announcedOnce) await new Promise((resolve) => setTimeout(resolve, RESULT_SPACING_MS));
    try {
      await announceOneResult(row);
      announcedOnce = true;
    } catch (err) {
      console.error(`✗ No se pudo anunciar el resultado ${row.eventName} ${row.round} (${row.player1Name} vs ${row.player2Name}):`, err);
    }
  }
}
