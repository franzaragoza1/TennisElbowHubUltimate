import { Client, GatewayIntentBits } from "discord.js";

/**
 * Único cliente de discord.js del proceso — todo lo demás en `lib/discordBot/` lo
 * importa de aquí, nunca crea el suyo propio.
 *
 * `MessageContent` y `GuildMembers` son intents PRIVILEGIADOS: hay que activarlos a
 * mano para el usuario bot en el Developer Portal (Bot > Privileged Gateway Intents).
 * Sin `MessageContent`, todo mensaje llega con `content` vacío y la entrevista
 * (`interactions/interviewMessage.ts`, que lee la respuesta del jugador) nunca
 * funciona, en silencio. Sin `GuildMembers`, el evento `GuildMemberAdd`
 * (`interactions/guildMemberAdd.ts`, el mensaje de bienvenida) simplemente nunca
 * dispara — Discord no manda ese evento a un bot sin este intent activado.
 */
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
