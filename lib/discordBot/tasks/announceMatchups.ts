/**
 * Anuncia un emparejamiento en cuanto los dos lados de un hueco del cuadro se
 * conocen — pedido explícito: embed "{p1} vs {p2} | {Torneo} {Año} {Ronda} | {Plazo}",
 * con el enlace a la web y a Mana Games bajo cada nombre, y un hilo para que organicen
 * el partido con un botón de confirmación por cada lado CON Discord vinculado.
 *
 * Clave de dedup: `(editionId, round, player1Id, player2Id)` — NUNCA `pending_slots.id`
 * (ver el comentario de `discordMatchupThreads` en db/schema.ts: esa fila se borra y
 * se vuelve a crear en cada recarga del torneo aunque sea el MISMO emparejamiento real
 * todavía sin jugar).
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";
import { and, eq, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordMatchupThreads, editionRoundDeadlines, editions, events, pendingSlots, players } from "@/db/schema";
import { resolvePlayerLinks } from "@/lib/playerLinks";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { discordClient } from "../client";
import { discordBotConfig } from "../config";
import { mentionOrBold, profileLinksLine } from "../mentions";

interface NewMatchupRow {
  editionId: number;
  round: string;
  drawSize: number;
  eventName: string;
  year: number;
  player1Id: number;
  player1Name: string;
  player1LinkedUserId: string | null;
  player2Id: number;
  player2Name: string;
  player2LinkedUserId: string | null;
  deadlineAt: Date | null;
}

async function findNewMatchups(): Promise<NewMatchupRow[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  return db
    .select({
      editionId: pendingSlots.editionId,
      round: pendingSlots.round,
      drawSize: editions.drawSize,
      eventName: events.displayName,
      year: editions.year,
      player1Id: p1.id,
      player1Name: p1.displayName,
      player1LinkedUserId: p1.linkedUserId,
      player2Id: p2.id,
      player2Name: p2.displayName,
      player2LinkedUserId: p2.linkedUserId,
      deadlineAt: editionRoundDeadlines.deadlineAt,
    })
    .from(pendingSlots)
    .innerJoin(editions, eq(editions.id, pendingSlots.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    // INNER, no LEFT: solo interesan huecos con los DOS lados ya resueltos — un lado
    // TBD (player*Id null) nunca puede casar con `p1.id`/`p2.id`, así que ya filtra solo.
    .innerJoin(p1, eq(p1.id, pendingSlots.player1Id))
    .innerJoin(p2, eq(p2.id, pendingSlots.player2Id))
    .leftJoin(
      editionRoundDeadlines,
      and(eq(editionRoundDeadlines.editionId, pendingSlots.editionId), eq(editionRoundDeadlines.round, pendingSlots.round)),
    )
    .where(
      notExists(
        db
          .select({ one: sql`1` })
          .from(discordMatchupThreads)
          .where(
            and(
              eq(discordMatchupThreads.editionId, pendingSlots.editionId),
              eq(discordMatchupThreads.round, pendingSlots.round),
              eq(discordMatchupThreads.player1Id, pendingSlots.player1Id),
              eq(discordMatchupThreads.player2Id, pendingSlots.player2Id),
            ),
          ),
      ),
    );
}

async function announceOneMatchup(row: NewMatchupRow): Promise<void> {
  const channel = await discordClient.channels.fetch(discordBotConfig.matchupsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const [links1, links2] = await Promise.all([
    resolvePlayerLinks({ playerId: row.player1Id, linkedUserId: row.player1LinkedUserId }),
    resolvePlayerLinks({ playerId: row.player2Id, linkedUserId: row.player2LinkedUserId }),
  ]);

  const mention1 = mentionOrBold(row.player1Name, links1.discordUserId);
  const mention2 = mentionOrBold(row.player2Name, links2.discordUserId);
  const roundLabel = roundDisplayLabel(fullRoundLadder(row.drawSize), row.round);
  const deadlineText = row.deadlineAt ? `<t:${Math.floor(row.deadlineAt.getTime() / 1000)}:F>` : "TBD";
  // Formato pedido explícito: "(player1 ping) vs (player2 ping) | [Tournament] [Year]
  // [Round] | [Deadline]". Va en el CONTENIDO del mensaje, no solo en el embed — un
  // mention dentro de un embed no notifica de verdad, solo el de `content` lo hace.
  const headline = `${mention1} vs ${mention2} | ${row.eventName} ${row.year} ${roundLabel} | Deadline: ${deadlineText}`;

  const embed = new EmbedBuilder()
    .setColor(0xe1ff00)
    .addFields(
      { name: row.player1Name, value: profileLinksLine(links1), inline: true },
      { name: row.player2Name, value: profileLinksLine(links2), inline: true },
    );

  // El hilo se crea ANTES de guardar nada en la base de datos a propósito: la fila de
  // seguimiento es lo que hace que `findNewMatchups` deje de reintentar este
  // emparejamiento — si se guardara antes y `startThread` fallara a medias, quedaría
  // "ya anunciado" para siempre sin hilo real detrás. Si algo de esto falla, no se
  // guarda nada y el siguiente ciclo simplemente lo vuelve a intentar entero.
  const message = await channel.send({ content: headline, embeds: [embed] });
  const thread = await message.startThread({
    name: `${row.player1Name} vs ${row.player2Name}`,
    autoArchiveDuration: 10080, // 7 días, el máximo — nunca se archiva solo mientras siga sin confirmar
  });

  const [tracking] = await db
    .insert(discordMatchupThreads)
    .values({
      editionId: row.editionId,
      round: row.round,
      player1Id: row.player1Id,
      player2Id: row.player2Id,
      threadId: thread.id,
      channelId: channel.id,
      messageId: message.id,
    })
    .returning({ id: discordMatchupThreads.id });

  const confirmRow = new ActionRowBuilder<ButtonBuilder>();
  if (links1.discordUserId) {
    confirmRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm:${tracking.id}:${row.player1Id}`)
        .setLabel(`Confirm — ${row.player1Name}`)
        .setStyle(ButtonStyle.Success),
    );
  }
  if (links2.discordUserId) {
    confirmRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm:${tracking.id}:${row.player2Id}`)
        .setLabel(`Confirm — ${row.player2Name}`)
        .setStyle(ButtonStyle.Success),
    );
  }

  await thread.send({
    content:
      `Chat here to organize your match! Deadline: ${deadlineText}.` +
      (confirmRow.components.length > 0
        ? " Press your confirm button once you've agreed on a time."
        : " Neither of you has a linked Discord account, so there's no confirm button here — this thread is just for organizing.") +
      " Need an extension for this match? Tag a Tour Moderator.",
    components: confirmRow.components.length > 0 ? [confirmRow] : [],
  });

  await thread.send({ content: `Match ID: ${tracking.id}` });
}

export async function announceNewMatchups(): Promise<void> {
  const rows = await findNewMatchups();
  for (const row of rows) {
    try {
      await announceOneMatchup(row);
    } catch (err) {
      console.error(`✗ No se pudo anunciar el emparejamiento ${row.eventName} ${row.round} (${row.player1Name} vs ${row.player2Name}):`, err);
    }
  }
}
