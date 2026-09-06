import type { PlayerProfileLinks } from "@/lib/playerLinks";

/** `<@id>` si tiene Discord vinculado (pinga de verdad, notifica); si no, el nombre en
 * negrita — pedido explícito: "Only pings players that have linked their discord, but
 * still displays the opponent user if not linked with their profile links." */
export function mentionOrBold(displayName: string, discordUserId: string | null): string {
  return discordUserId ? `<@${discordUserId}>` : `**${displayName}**`;
}

/** "Under the players name there is both their respective website profile and
 * managames profile link" — nunca el de Discord aquí, ya están nombrados/pingados en
 * el propio Discord. Un jugador sin alias de Mana Games simplemente no enseña ese
 * segundo enlace, nunca se inventa uno. */
export function profileLinksLine(links: Pick<PlayerProfileLinks, "websiteProfileUrl" | "manaProfileUrl">): string {
  const parts = [`[Website](${links.websiteProfileUrl})`];
  if (links.manaProfileUrl) parts.push(`[Mana Games](${links.manaProfileUrl})`);
  return parts.join(" · ");
}
