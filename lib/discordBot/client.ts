import { Client, GatewayIntentBits } from "discord.js";

/**
 * Único cliente de discord.js del proceso — todo lo demás en `lib/discordBot/` lo
 * importa de aquí, nunca crea el suyo propio.
 *
 * `MessageContent` es un intent PRIVILEGIADO: hay que activarlo a mano para el usuario
 * bot en el Developer Portal (Bot > Privileged Gateway Intents > Message Content
 * Intent) — si no, todo mensaje llega con `content` vacío y la entrevista
 * (`interactions/interviewMessage.ts`, que lee la respuesta del jugador) nunca
 * funciona, en silencio.
 */
export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
