/**
 * Termina un sondeo de Discord antes de que expire solo — REST puro (`POST
 * .../polls/{message}/expire`), sin necesidad de una conexión de gateway activa a
 * diferencia del resto de `lib/discordBot/`. Por eso esto SÍ puede llamarse directo
 * desde una server action de Next (app/admin/awards/actions.ts::closeVoting) en vez de
 * tener que pasar por el proceso aparte del bot (`scripts/discordBot.ts`), que es
 * quien de verdad publica el sondeo y lee el recuento final (ese sí necesita el
 * cliente de gateway con caché de mensajes, ver
 * lib/discordBot/tasks/syncAwardsPollResults.ts).
 *
 * `DISCORD_BOT_TOKEN` se lee aquí directo de `process.env`, no de
 * `discordBotConfig.token` (ese objeto exige TAMBIÉN `DISCORD_GUILD_ID` y los canales
 * de toda la vida con `required()`, y lanzaría en cuanto Next importase este módulo
 * aunque el entorno del sitio nunca haya necesitado esas otras variables) — igual que
 * `DISCORD_AWARDS_CHANNEL_ID`, opcional y leído directo en las tareas de premios.
 */
export async function endDiscordPollEarly(channelId: string, messageId: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN isn't configured.");

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/polls/${messageId}/expire`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Discord returned ${res.status} ending poll ${messageId}: ${await res.text()}`);
  }
}
