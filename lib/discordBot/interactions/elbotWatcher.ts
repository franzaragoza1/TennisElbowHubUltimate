/**
 * Escucha el canal de `elbot` (bot ajeno, ya en el mismo servidor — pedido explícito
 * del propietario, 2026-09-24) para saber quién busca rival ahora mismo. Nunca
 * escribe nada en ese canal ni interactúa con `elbot` de ninguna forma — solo LEE
 * mensajes públicos de un canal al que este bot ya tiene acceso, exactamente igual
 * que cualquier otro mensaje que ya procesa (ver interviewMessage.ts).
 *
 * `DISCORD_ELBOT_CHANNEL_ID` opcional, mismo criterio que `DISCORD_AWARDS_CHANNEL_ID`
 * (ver announceAwardsVotingOpened.ts): sin configurar, esto simplemente no hace nada,
 * nunca tira abajo el resto del bot.
 */
import { ChannelType, type Message } from "discord.js";
import { parseElbotMessage, type GameFinished } from "../elbotMessages";
import { clearWaitingByShortName, recordWaitingAnnouncement } from "../waitingPlayers";
import { formatFinishedMatchAnnouncement } from "../tasks/liveBoardCards";
import { refreshLiveBoard } from "../tasks/liveBoard";
import { discordClient } from "../client";

/** Aviso suelto de un partido recién terminado, en el mismo canal que el tablero —
 * pedido explícito del propietario, 2026-09-27: "add the finished matches of the day".
 * Mensaje NUEVO (nunca dentro del embed editado) y siempre seguido de un refresco del
 * tablero, para que este vuelva a quedar como el último mensaje del canal (ver el
 * comentario de `refreshLiveBoard` en liveBoard.ts). Aparte de `handleElbotMessage`
 * a propósito: es la única rama de este fichero que de verdad necesita red/Discord.js,
 * el resto sigue siendo síncrono y sin I/O. */
async function announceFinishedMatch(event: GameFinished): Promise<void> {
  const channelId = process.env.DISCORD_LIVE_BOARD_CHANNEL_ID;
  if (!channelId) return;

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.send({ content: formatFinishedMatchAnnouncement(event) });
  await refreshLiveBoard();
}

export function handleElbotMessage(message: Message): void {
  const elbotChannelId = process.env.DISCORD_ELBOT_CHANNEL_ID;
  if (!elbotChannelId || message.channelId !== elbotChannelId) return;

  const event = parseElbotMessage(message.content);
  if (!event) return; // formato no reconocido (mensaje roto...) — se ignora, nunca se adivina

  if (event.type === "waiting") {
    recordWaitingAnnouncement(event);
  } else if (event.type === "started") {
    // Los dos jugadores dejan de estar "buscando rival" a la vez.
    clearWaitingByShortName(event.player1Short);
    clearWaitingByShortName(event.player2Short);
  } else {
    announceFinishedMatch(event).catch((err) => console.error("✗ Fallo anunciando un partido terminado:", err));
  }
}
