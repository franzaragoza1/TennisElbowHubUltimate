/**
 * Config leída del entorno al arrancar `scripts/discordBot.ts` — mismo criterio que
 * `db/client.ts` con `DATABASE_URL`: falta cualquiera de estas y el proceso entero no
 * tiene sentido, así que se falla ruidosamente ya al importar este módulo, no a medias
 * en la primera vez que hace falta el valor.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en el entorno — necesario para el bot de Discord (ver .env.example).`);
  }
  return value;
}

/** Opcional, mismo criterio que `roleConfig.ts`: mientras no esté puesta, la tarea que
 * la usa (`tasks/notifyClaimApproved.ts`) simplemente no hace nada, nunca tira abajo
 * el resto del bot. */
function optional(name: string): string | null {
  return process.env[name] || null;
}

export const discordBotConfig = {
  token: required("DISCORD_BOT_TOKEN"),
  guildId: required("DISCORD_GUILD_ID"),
  matchupsChannelId: required("DISCORD_MATCHUPS_CHANNEL_ID"),
  resultsChannelId: required("DISCORD_RESULTS_CHANNEL_ID"),
  claimApprovedChannelId: optional("DISCORD_CLAIM_APPROVED_CHANNEL_ID"),
};
