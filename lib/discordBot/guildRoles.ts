/**
 * Roles reales del servidor de Discord, para el desplegable de menciones del discurso
 * de premios (components/admin/RichTextEditor.tsx, pedido explícito del propietario:
 * "In the speech admins can tag, either roles or everyone"). REST puro, mismo criterio
 * que lib/discordBot/pollRest.ts — leer roles no necesita conexión de gateway, así que
 * se llama directo desde una server action de Next sin pasar por el proceso del bot.
 */
export interface DiscordRoleOption {
  id: string;
  name: string;
}

interface RawDiscordRole {
  id: string;
  name: string;
  managed: boolean;
}

export async function fetchGuildRoles(): Promise<DiscordRoleOption[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return [];

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return [];

  const roles: RawDiscordRole[] = await res.json();
  // @everyone ya se ofrece aparte como opción fija (es una palabra clave de Discord,
  // no necesita id) — y un rol "managed" (el de un bot, el de Nitro booster...) no
  // tiene sentido pingarlo a mano desde un discurso.
  return roles
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .map((r) => ({ id: r.id, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
