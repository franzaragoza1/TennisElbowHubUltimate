/**
 * Tablero "esperando rival / en vivo" en un canal propio — pedido explícito del
 * propietario, 2026-09-24: TODOS los partidos de TE4 en live-tennis.cn (no solo los
 * del propio tour, ver el comentario de fetchLiveHtml/parseLivePage) mezclados con
 * quién busca rival ahora mismo (elbotWatcher.ts + waitingPlayers.ts). Se EDITA el
 * mismo mensaje en cada pasada — nunca publica uno nuevo — para no saturar el canal;
 * `discordLiveBoard` (fila única, mismo criterio que `liveScoresCache`) solo guarda
 * el id de ESE mensaje, para sobrevivir un reinicio del bot sin perder cuál es.
 *
 * `DISCORD_LIVE_BOARD_CHANNEL_ID` opcional (mismo criterio que
 * `DISCORD_AWARDS_CHANNEL_ID`) — sin configurar, esta tarea simplemente no hace nada.
 */
import { EmbedBuilder, ChannelType } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { discordLiveBoard } from "@/db/schema";
import { discordClient } from "../client";
import { fetchLiveHtml } from "@/lib/liveTennis/fetchLive";
import { parseLivePage, type RawLiveMatch } from "@/lib/liveTennis/parseLivePage";
import { listCurrentWaitingPlayers, type WaitingEntry } from "../waitingPlayers";

const BOARD_ROW_ID = 1;
/** Como mucho esto de cada sección — un torneo de verdad activo puede tener decenas
 * de partidos a la vez, y un `embed` de Discord tiene un límite real de caracteres
 * por campo (1024). "+N more" en vez de cortar a medias una línea. */
const MAX_ENTRIES_PER_SECTION = 12;

function eloLabel(elo: number | null): string {
  return elo === null ? "unrated" : `elo ${elo}`;
}

function formatLiveMatch(match: RawLiveMatch): string {
  const scoreLine = match.player1.setGames.map((g, i) => `${g}-${match.player2.setGames[i]}`).join(" ");
  const point = match.player1.currentPoint || match.player2.currentPoint ? ` (${match.player1.currentPoint}-${match.player2.currentPoint})` : "";
  return `**${match.player1.name}** (${eloLabel(match.player1.elo)}) vs **${match.player2.name}** (${eloLabel(match.player2.elo)}) — ${scoreLine}${point} · ${match.courtTitle}`;
}

function formatWaitingEntry(entry: WaitingEntry): string {
  return `**${entry.displayName}** (elo ${entry.elo}, rep ${entry.rep}%) — \`${entry.sets}-set\` \`${entry.difficulty}\`/\`${entry.mode}\``;
}

function sectionValue(lines: string[]): string {
  if (lines.length === 0) return "_Nobody right now._";
  const shown = lines.slice(0, MAX_ENTRIES_PER_SECTION);
  const rest = lines.length - shown.length;
  return shown.join("\n") + (rest > 0 ? `\n_+${rest} more_` : "");
}

async function buildBoardEmbed(): Promise<EmbedBuilder> {
  let liveMatches: RawLiveMatch[] = [];
  try {
    liveMatches = parseLivePage(await fetchLiveHtml());
  } catch {
    // Igual que scripts/liveScoresSync.ts: live-tennis.cn puede fallar (Cloudflare,
    // caída puntual) sin que eso deba tumbar el resto del tablero — se enseña la
    // sección de "en vivo" vacía esta pasada, no un error.
  }
  const waitingEntries = listCurrentWaitingPlayers();

  return new EmbedBuilder()
    .setColor(0x0057b8)
    .setTitle("🎾 XKT Live Board")
    .addFields(
      { name: `🔴 Live now (${liveMatches.length})`, value: sectionValue(liveMatches.map(formatLiveMatch)) },
      { name: `⏳ Waiting for an opponent (${waitingEntries.length})`, value: sectionValue(waitingEntries.map(formatWaitingEntry)) },
    )
    .setFooter({ text: "Every TE4 match on live-tennis.cn, not just tour matches" })
    .setTimestamp();
}

export async function refreshLiveBoard(): Promise<void> {
  const channelId = process.env.DISCORD_LIVE_BOARD_CHANNEL_ID;
  if (!channelId) return;

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = await buildBoardEmbed();

  const [row] = await db.select({ messageId: discordLiveBoard.messageId }).from(discordLiveBoard).where(eq(discordLiveBoard.id, BOARD_ROW_ID));

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
    .insert(discordLiveBoard)
    .values({ id: BOARD_ROW_ID, messageId: message.id })
    .onConflictDoUpdate({ target: discordLiveBoard.id, set: { messageId: message.id, updatedAt: new Date() } });
}
