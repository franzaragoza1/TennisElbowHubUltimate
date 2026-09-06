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

export const discordBotConfig = {
  token: required("DISCORD_BOT_TOKEN"),
  guildId: required("DISCORD_GUILD_ID"),
  matchupsChannelId: required("DISCORD_MATCHUPS_CHANNEL_ID"),
  resultsChannelId: required("DISCORD_RESULTS_CHANNEL_ID"),
};
