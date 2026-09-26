/**
 * URL del avatar de un usuario de Discord — misma fórmula que usa el proveedor de
 * Auth.js por dentro (@auth/core/providers/discord.js): sin avatar propio, Discord sirve
 * uno de sus avatares "embed" por defecto (elegido a partir del id/discriminator), nunca
 * null. Pura, compartida por el login (auth.ts) y por la sincronización periódica del
 * bot (lib/discordBot/tasks/syncAvatars.ts) para que las dos calculen exactamente lo
 * mismo.
 */
export function discordAvatarUrl(user: { id: string; avatar: string | null; discriminator?: string | null }): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}`;
  }
  const index = !user.discriminator || user.discriminator === "0" ? Number(BigInt(user.id) >> BigInt(22)) % 6 : parseInt(user.discriminator, 10) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
