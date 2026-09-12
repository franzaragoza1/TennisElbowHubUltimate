/**
 * Mensaje de bienvenida por DM en cuanto alguien se une al servidor — reemplaza la
 * función de pago de MEE6 con el propio bot del tour, sin coste extra. Pedido
 * explícito: por privado, no en un canal público, así que no hace falta ningún canal
 * configurado — `member.send(...)` abre (o reusa) el DM directamente.
 *
 * Un DM puede fallar sin que sea un error de verdad (DMs cerrados a miembros del
 * servidor, bot bloqueado...) — se registra y se sigue, nunca tira abajo el resto del
 * ciclo de sondeo ni el evento de unión de nadie más.
 *
 * Necesita el intent privilegiado `GuildMembers` activado en el Developer Portal (ver
 * el comentario de lib/discordBot/client.ts) — sin eso, Discord no manda este evento
 * en absoluto, en silencio.
 */
import { EmbedBuilder, type GuildMember } from "discord.js";
import { siteBaseUrl } from "@/lib/playerLinks";

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  const base = siteBaseUrl();
  const embed = new EmbedBuilder()
    .setColor(0xc4d82e)
    .setAuthor({ name: member.guild.name })
    .setTitle("Welcome to the TE4 Online Tour! 🎾")
    .setDescription(
      "The tour is played on the **Mana Games forum** — that's where you register and play. This Discord is where matches get organized, announced, and discussed.",
    )
    .setThumbnail(member.guild.iconURL())
    .setFooter({ text: "TE4 XKT Tour · glad to have you here" });

  if (base) {
    embed.addFields(
      { name: "🌐 Website", value: `[Live scores, rankings, H2H, stats, player profiles](${base})` },
      { name: "🚀 Getting started", value: `[2-minute walkthrough: sign in, find your name, attach your stats](${base}/welcome)` },
    );
  }

  try {
    await member.send({ content: `Welcome to **${member.guild.name}**! 🎾`, embeds: [embed] });
  } catch (err) {
    console.error(`✗ No se pudo mandar el DM de bienvenida a ${member.user.tag}:`, err);
  }
}
