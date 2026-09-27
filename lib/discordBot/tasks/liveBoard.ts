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
import { listCurrentWaitingPlayers } from "../waitingPlayers";
import { formatLiveMatchCard, formatWaitingCard, spacerField } from "./liveBoardCards";

const BOARD_ROW_ID = 1;
/** Como mucho esto de cada sección, como campos aparte — un `embed` de Discord admite
 * 25 campos como mucho en total; con un campo POR partido/anuncio (para que cada uno
 * se vea como su propia tarjeta, pedido explícito, 2026-09-24: "structure every match
 * so that its similar to an actual match card"), este techo por sección deja sitio de
 * sobra para las dos a la vez sin acercarse al límite real. */
const MAX_ENTRIES_PER_SECTION = 10;

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

  const embed = new EmbedBuilder()
    .setColor(0x0057b8)
    .setTitle("🎾 XKT Live Board")
    .setDescription(`🔴 **${liveMatches.length}** live · ⏳ **${waitingEntries.length}** looking for an opponent`)
    .setTimestamp();

  const shownLive = liveMatches.slice(0, MAX_ENTRIES_PER_SECTION);
  const shownWaiting = waitingEntries.slice(0, MAX_ENTRIES_PER_SECTION);

  if (shownLive.length === 0 && shownWaiting.length === 0) {
    embed.addFields({ name: "🎾 It's quiet right now", value: "_Nobody playing or waiting for an opponent._" });
    return embed;
  }

  for (const match of shownLive) embed.addFields(formatLiveMatchCard(match));
  if (liveMatches.length > shownLive.length) embed.addFields({ name: "​", value: `_+${liveMatches.length - shownLive.length} more live_` });

  if (shownLive.length > 0 && shownWaiting.length > 0) embed.addFields(spacerField());

  for (const entry of shownWaiting) embed.addFields(formatWaitingCard(entry));
  if (waitingEntries.length > shownWaiting.length) embed.addFields({ name: "​", value: `_+${waitingEntries.length - shownWaiting.length} more waiting_` });

  return embed;
}

// Discord no renderiza enlaces enmascarados `[texto](url)` en el contenido plano de un
// mensaje (solo dentro de un embed) — es una protección anti-phishing de la propia
// plataforma. Por eso el enlace a "Results" va como línea de contenido normal, con la
// URL visible, en vez de intentar un markdown que Discord ignoraría.
const RESULTS_LINE = `**Results** → https://tenniselbowhub.live/live`;

/**
 * Encolado en memoria, nunca dos pasadas a la vez — bug real reportado, 2026-09-27:
 * "there are two boards appearing in the channel". Con los avisos de partido
 * terminado disparando un refresco FUERA del ciclo normal de 45s (ver
 * elbotWatcher.ts), dos pasadas podían solaparse: las dos leían el mismo
 * `messageId` guardado, las dos lo veían "ya no es el último" (una lo había borrado
 * ya, o el propio aviso había cambiado `lastMessageId` para las dos a la vez) y las
 * dos acababan publicando su propio mensaje nuevo — el de la primera se quedaba
 * huérfano en el canal, sin que nada lo siguiera rastreando. Encadenar cada llamada
 * detrás de la anterior (nunca en paralelo) es suficiente: es un solo proceso, nunca
 * hay dos bots a la vez escribiendo el mismo tablero.
 */
let refreshChain: Promise<void> = Promise.resolve();

export function refreshLiveBoard(): Promise<void> {
  const next = refreshChain.then(() => refreshLiveBoardNow());
  // Nunca deja la cadena rota por un fallo de una pasada — la siguiente llamada debe
  // poder correr igualmente, no quedarse esperando para siempre detrás de un rechazo.
  refreshChain = next.catch(() => {});
  return next;
}

async function refreshLiveBoardNow(): Promise<void> {
  const channelId = process.env.DISCORD_LIVE_BOARD_CHANNEL_ID;
  if (!channelId) return;

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = await buildBoardEmbed();

  const [row] = await db.select({ messageId: discordLiveBoard.messageId }).from(discordLiveBoard).where(eq(discordLiveBoard.id, BOARD_ROW_ID));

  if (row?.messageId) {
    try {
      const message = await channel.messages.fetch(row.messageId);
      // Pedido explícito del propietario, 2026-09-27: el tablero tiene que ser SIEMPRE
      // el último mensaje del canal — desde que también se avisan ahí los partidos
      // recién terminados (ver elbotWatcher.ts), un simple `edit` dejaría el tablero
      // enterrado por encima de ese aviso nuevo en vez de quedarse abajo del todo.
      // `channel.lastMessageId` ya lo mantiene al día discord.js con cada mensaje que
      // llega por el propio gateway (incluidos los del propio bot), así que comprobarlo
      // no cuesta una petición aparte.
      if (channel.lastMessageId === message.id) {
        await message.edit({ content: RESULTS_LINE, embeds: [embed] });
        return;
      }
      await message.delete().catch(() => {});
      // Sigue más abajo: se publica uno nuevo para recuperar el último puesto.
    } catch {
      // El mensaje ya no existe (alguien lo borró a mano) — se publica uno nuevo más
      // abajo en vez de quedarse editando algo que ya no está.
    }
  }

  const message = await channel.send({ content: RESULTS_LINE, embeds: [embed] });
  await db
    .insert(discordLiveBoard)
    .values({ id: BOARD_ROW_ID, messageId: message.id })
    .onConflictDoUpdate({ target: discordLiveBoard.id, set: { messageId: message.id, updatedAt: new Date() } });
}
