/**
 * `/announce` — portado del bot Python "side code" del propietario, ver
 * newTournament.ts para el contexto completo de esta migración. Este comando no tenía
 * ninguna dependencia de `XKTTBSTD/` ni de superficies, así que es un port directo.
 */
import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

export const announceCommand = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Create an official announcement with special embed formatting")
  .addChannelOption((opt) =>
    opt.setName("channel").setDescription("The target text channel for the announcement").addChannelTypes(ChannelType.GuildText).setRequired(true),
  )
  .addRoleOption((opt) => opt.setName("role").setDescription("The role to tag in the announcement").setRequired(true))
  .addStringOption((opt) => opt.setName("title").setDescription("Title of the announcement").setRequired(true))
  .addStringOption((opt) => opt.setName("message").setDescription("Text of the announcement").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function handleAnnounceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]);
  const role = interaction.options.getRole("role", true);
  const title = interaction.options.getString("title", true);
  const message = interaction.options.getString("message", true);

  // '### ' (H3) delante de cada línea no vacía — el mismo trato "más grande" que
  // hacía el original.
  const enlargedMessage = message
    .split("\n")
    .map((line) => (line.trim() ? `### ${line}` : ""))
    .join("\n");

  const embed = new EmbedBuilder().setDescription(`# 📢 ${title}\n\n${enlargedMessage}`).setColor(0xff0000);

  await channel.send({ content: `<@&${role.id}>`, embeds: [embed] });
  await interaction.reply({ content: `✅ Official announcement sent successfully in ${channel}!`, ephemeral: true });
}
