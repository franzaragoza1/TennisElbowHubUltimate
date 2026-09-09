import type { AwardPeriodRow } from "./queries";

/** "September 2026" / "2026 Yearly Awards" — repetido antes en cuatro sitios distintos
 * (la sección de admin, la lista de ganadores pasados, la ficha pública de un período,
 * y ahora las dos tareas del bot de Discord); consolidado aquí para que un cambio de
 * formato no tenga que tocar los cinco. */
export function periodLabel(p: Pick<AwardPeriodRow, "cycle" | "year" | "month">): string {
  if (p.cycle === "monthly" && p.month) {
    const name = new Date(Date.UTC(2000, p.month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    return `${name} ${p.year}`;
  }
  return `${p.year} Yearly Awards`;
}

/** "P1 vs P2 — Event Year (Round)" -> "P1 vs P2" — el contexto de torneo/ronda sobra en
 * un resumen compacto (tarjeta de "Past winners", respuesta de un sondeo de Discord).
 * Ver también lib/discordBot/tasks/announceAwardsVotingOpened.ts::matchupOnly, que
 * además reordena para que el nominado salga primero. */
export function matchupOnly(matchLabel: string): string {
  return matchLabel.split(" — ")[0];
}

/** Enlace directo al mensaje de Discord que lleva el sondeo real de una categoría — el
 * voto pasa ahí, no en el sitio (ver components/awards/CategoryNomineeGroup.tsx). null
 * si falta DISCORD_GUILD_ID/DISCORD_AWARDS_CHANNEL_ID en el entorno del sitio, o si el
 * bot todavía no ha publicado el sondeo de esa categoría (discordPollMessageId null). */
export function discordPollLink(messageId: string | null): string | null {
  const guildId = process.env.DISCORD_GUILD_ID;
  const channelId = process.env.DISCORD_AWARDS_CHANNEL_ID;
  if (!messageId || !guildId || !channelId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
