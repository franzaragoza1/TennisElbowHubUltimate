/**
 * Dos cosas en cuanto alguien se une al servidor:
 *
 * 1. Mensaje de bienvenida por DM — reemplaza la función de pago de MEE6 con el
 *    propio bot del tour, sin coste extra. Pedido explícito: por privado, no en un
 *    canal público, así que no hace falta ningún canal configurado —
 *    `member.send(...)` abre (o reusa) el DM directamente.
 * 2. Rol "Starter" TEMPORAL (pedido explícito del propietario, 2026-09-19: 2 semanas
 *    y 3 días, solo para quien se une A PARTIR de ahora, nunca retroactivo a
 *    miembros ya existentes) — `syncRoles.ts::expireTemporaryRoleGrants` lo quita
 *    solo al caducar, en su ciclo de sondeo de 15 min.
 *
 * Cada paso falla por su cuenta sin tirar abajo el otro (un DM puede fallar sin que
 * sea un error de verdad — DMs cerrados a miembros del servidor, bot bloqueado...) —
 * se registra y se sigue, nunca tira abajo el resto del ciclo de sondeo ni el evento
 * de unión de nadie más.
 *
 * Necesita el intent privilegiado `GuildMembers` activado en el Developer Portal (ver
 * el comentario de lib/discordBot/client.ts) — sin eso, Discord no manda este evento
 * en absoluto, en silencio.
 */
import { EmbedBuilder, type GuildMember } from "discord.js";
import { db } from "@/db/client";
import { discordTemporaryRoleGrants } from "@/db/schema";
import { siteBaseUrl } from "@/lib/playerLinks";
import { discordRoleConfig } from "../roleConfig";

const STARTER_ROLE_DURATION_MS = (14 + 3) * 24 * 60 * 60 * 1000; // 2 semanas y 3 días

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

  const starterRoleId = discordRoleConfig.starter;
  if (starterRoleId) {
    try {
      await member.roles.add(starterRoleId);
      await db
        .insert(discordTemporaryRoleGrants)
        .values({ roleKey: "starter", discordUserId: member.id, expiresAt: new Date(Date.now() + STARTER_ROLE_DURATION_MS) })
        .onConflictDoNothing({ target: [discordTemporaryRoleGrants.roleKey, discordTemporaryRoleGrants.discordUserId] });
    } catch (err) {
      console.error(`✗ No se pudo dar el rol Starter a ${member.user.tag}:`, err);
    }
  }
}
