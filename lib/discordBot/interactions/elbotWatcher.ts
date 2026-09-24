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
import type { Message } from "discord.js";
import { parseElbotMessage } from "../elbotMessages";
import { clearWaitingByShortName, recordWaitingAnnouncement } from "../waitingPlayers";

export function handleElbotMessage(message: Message): void {
  const elbotChannelId = process.env.DISCORD_ELBOT_CHANNEL_ID;
  if (!elbotChannelId || message.channelId !== elbotChannelId) return;

  const event = parseElbotMessage(message.content);
  if (!event) return; // formato no reconocido (resultado final, mensaje roto...) — se ignora, nunca se adivina

  if (event.type === "waiting") {
    recordWaitingAnnouncement(event);
  } else {
    // Los dos jugadores dejan de estar "buscando rival" a la vez.
    clearWaitingByShortName(event.player1Short);
    clearWaitingByShortName(event.player2Short);
  }
}
