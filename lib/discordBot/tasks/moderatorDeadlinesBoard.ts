/**
 * Tablero + avisos de "partidos que necesitan un moderador" — pedido explícito del
 * propietario, 2026-09-27: "Moderators need a better look for all matches that are
 * almost or already past the deadlines, also telling if that particular match hasn't
 * been discussed [...] ping [specific moderators] inside this channel when necessary".
 *
 * Dos piezas separadas a propósito, en el MISMO canal:
 * - El tablero (`refreshModeratorBoard`) se EDITA cada pasada, nunca notifica a nadie
 *   (un embed editado, o incluso un mention dentro de un embed, no dispara
 *   notificación — solo el `content` de un mensaje NUEVO lo hace, ver el comentario de
 *   `announceMatchups.ts`). Es "la vista", siempre al día.
 * - Los avisos (`sendModeratorAlerts`) son mensajes NUEVOS con mention de verdad en
 *   `content`, y solo se mandan la PRIMERA vez que un partido pasa a "casi/ya vencido
 *   y sin discutir" (`moderator_alerted_at`) — nunca en cada pasada, para no
 *   acostumbrar a los moderadores a ignorar el canal.
 *
 * `DISCORD_MODERATOR_ALERTS_CHANNEL_ID`/`DISCORD_MODERATOR_USER_IDS` opcionales,
 * mismo criterio que `DISCORD_LIVE_BOARD_CHANNEL_ID` — sin configurar, esta tarea
 * simplemente no hace nada.
 */
import { EmbedBuilder, ChannelType } from "discord.js";
import { and, eq, isNull, notInArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordMatchupThreads, discordModeratorBoard, editionRoundDeadlines, editions, events, matches, players } from "@/db/schema";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { discordClient } from "../client";
import { discordBotConfig } from "../config";
import { classifyForBoard, formatBoardCard, sortForBoard, threadJumpUrl, type BoardEntry, type ClassifiedEntry } from "../moderatorDeadlines";

const BOARD_ROW_ID = 1;
// Un embed de Discord admite 25 campos como mucho — de sobra para lo que de verdad
// hace falta ver de golpe (mismo criterio que liveBoard.ts).
const MAX_BOARD_ENTRIES = 20;

function moderatorUserIds(): string[] {
  return (process.env.DISCORD_MODERATOR_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function findCandidates(): Promise<ClassifiedEntry[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const nowMs = Date.now();

  const rows = await db
    .select({
      id: discordMatchupThreads.id,
      threadId: discordMatchupThreads.threadId,
      editionId: discordMatchupThreads.editionId,
      round: discordMatchupThreads.round,
      drawSize: editions.drawSize,
      eventName: events.displayName,
      player1Id: discordMatchupThreads.player1Id,
      player1Name: p1.displayName,
      player1LinkedUserId: p1.linkedUserId,
      player1ConfirmedAt: discordMatchupThreads.player1ConfirmedAt,
      player2Id: discordMatchupThreads.player2Id,
      player2Name: p2.displayName,
      player2LinkedUserId: p2.linkedUserId,
      player2ConfirmedAt: discordMatchupThreads.player2ConfirmedAt,
      extensionDays: discordMatchupThreads.extensionDays,
      lastActivityAt: discordMatchupThreads.lastActivityAt,
      moderatorAlertedAt: discordMatchupThreads.moderatorAlertedAt,
      deadlineAt: editionRoundDeadlines.deadlineAt,
    })
    .from(discordMatchupThreads)
    .innerJoin(editions, eq(editions.id, discordMatchupThreads.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, discordMatchupThreads.player1Id))
    .innerJoin(p2, eq(p2.id, discordMatchupThreads.player2Id))
    .leftJoin(
      editionRoundDeadlines,
      and(eq(editionRoundDeadlines.editionId, discordMatchupThreads.editionId), eq(editionRoundDeadlines.round, discordMatchupThreads.round)),
    )
    // Defensivo: una fila cuyo partido ya se jugó puede seguir aquí si nunca se llegó a
    // limpiar (ver el comentario de `closeMatchupThread` en announceResults.ts) — sin
    // esto, un partido ya terminado hace tiempo seguiría saliendo como "vencido y sin
    // discutir" para siempre.
    .where(
      notInArray(
        discordMatchupThreads.id,
        db
          .select({ id: discordMatchupThreads.id })
          .from(discordMatchupThreads)
          .innerJoin(
            matches,
            and(
              eq(matches.editionId, discordMatchupThreads.editionId),
              eq(matches.round, discordMatchupThreads.round),
              or(
                and(eq(matches.player1Id, discordMatchupThreads.player1Id), eq(matches.player2Id, discordMatchupThreads.player2Id)),
                and(eq(matches.player1Id, discordMatchupThreads.player2Id), eq(matches.player2Id, discordMatchupThreads.player1Id)),
              ),
            ),
          ),
      ),
    );

  const classified: ClassifiedEntry[] = [];
  for (const row of rows) {
    if (!row.deadlineAt) continue; // Mana todavía no publica el plazo de esta ronda
    const linked1 = row.player1LinkedUserId !== null;
    const linked2 = row.player2LinkedUserId !== null;
    const entry: BoardEntry = {
      id: row.id,
      threadId: row.threadId,
      eventName: row.eventName,
      roundLabel: roundDisplayLabel(fullRoundLadder(row.drawSize), row.round),
      player1Name: row.player1Name,
      player2Name: row.player2Name,
      effectiveDeadlineMs: row.deadlineAt.getTime() + row.extensionDays * 24 * 60 * 60 * 1000,
      fullyConfirmed: (!linked1 || row.player1ConfirmedAt !== null) && (!linked2 || row.player2ConfirmedAt !== null),
      lastActivityAt: row.lastActivityAt?.getTime() ?? null,
      player1ConfirmedAt: row.player1ConfirmedAt?.getTime() ?? null,
      player2ConfirmedAt: row.player2ConfirmedAt?.getTime() ?? null,
    };
    const result = classifyForBoard(entry, nowMs);
    if (result) classified.push(result);
  }
  return sortForBoard(classified);
}

async function buildBoardEmbed(classified: ClassifiedEntry[]): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(0xd6293e)
    .setTitle("🧑‍⚖️ Matches needing a moderator's eye")
    .setTimestamp();

  if (classified.length === 0) {
    embed.setDescription("_Nothing overdue or close to deadline right now._");
    return embed;
  }

  const overdueCount = classified.filter((c) => c.overdue).length;
  embed.setDescription(`🔴 **${overdueCount}** overdue · 🟡 **${classified.length - overdueCount}** close to deadline`);

  const shown = classified.slice(0, MAX_BOARD_ENTRIES);
  for (const c of shown) embed.addFields(formatBoardCard(discordBotConfig.guildId, c));
  if (classified.length > shown.length) {
    embed.addFields({ name: "​", value: `_+${classified.length - shown.length} more_` });
  }
  return embed;
}

export async function refreshModeratorBoard(classified: ClassifiedEntry[]): Promise<void> {
  const channelId = process.env.DISCORD_MODERATOR_ALERTS_CHANNEL_ID;
  if (!channelId) return;

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = await buildBoardEmbed(classified);

  const [row] = await db.select({ messageId: discordModeratorBoard.messageId }).from(discordModeratorBoard).where(eq(discordModeratorBoard.id, BOARD_ROW_ID));

  if (row?.messageId) {
    try {
      const message = await channel.messages.fetch(row.messageId);
      await message.edit({ embeds: [embed] });
      return;
    } catch {
      // El mensaje ya no existe (alguien lo borró a mano) — se publica uno nuevo más
      // abajo en vez de quedarse editando algo que ya no está.
    }
  }

  const message = await channel.send({ embeds: [embed] });
  await db
    .insert(discordModeratorBoard)
    .values({ id: BOARD_ROW_ID, messageId: message.id })
    .onConflictDoUpdate({ target: discordModeratorBoard.id, set: { messageId: message.id, updatedAt: new Date() } });
}

/** Avisa una sola vez por partido, la primera vez que se detecta "casi/ya vencido y
 * sin discutir" — un mensaje nuevo con mention real en `content` (nunca dentro de un
 * embed, no notificaría), listando los partidos nuevos de esta pasada. */
export async function sendModeratorAlerts(classified: ClassifiedEntry[]): Promise<void> {
  const channelId = process.env.DISCORD_MODERATOR_ALERTS_CHANNEL_ID;
  const userIds = moderatorUserIds();
  if (!channelId || userIds.length === 0) return;

  const rows = await db
    .select({ id: discordMatchupThreads.id })
    .from(discordMatchupThreads)
    .where(isNull(discordMatchupThreads.moderatorAlertedAt));
  const notYetAlerted = new Set(rows.map((r) => r.id));

  const toAlert = classified.filter((c) => c.undiscussed && notYetAlerted.has(c.entry.id));
  if (toAlert.length === 0) return;

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const mentions = userIds.map((id) => `<@${id}>`).join(" ");
  const lines = toAlert.map((c) => {
    const status = c.overdue ? "already past its deadline" : "close to its deadline";
    return `• **${c.entry.player1Name}** vs **${c.entry.player2Name}** (${c.entry.eventName} ${c.entry.roundLabel}, ${status}) — no activity yet. ${threadJumpUrl(discordBotConfig.guildId, c.entry.threadId)}`;
  });

  await channel.send({
    content: `${mentions} ${toAlert.length === 1 ? "this match needs" : "these matches need"} a look — no messages from either player, no confirmation:\n${lines.join("\n")}`,
    allowedMentions: { users: userIds },
  });

  await db
    .update(discordMatchupThreads)
    .set({ moderatorAlertedAt: new Date() })
    .where(
      toAlert.length === 1
        ? eq(discordMatchupThreads.id, toAlert[0].entry.id)
        : or(...toAlert.map((c) => eq(discordMatchupThreads.id, c.entry.id))),
    );
}

export async function runModeratorDeadlinesCycle(): Promise<void> {
  const classified = await findCandidates();
  await refreshModeratorBoard(classified);
  await sendModeratorAlerts(classified);
}
