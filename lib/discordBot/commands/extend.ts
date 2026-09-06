/**
 * `/extend match_id:<int> days:<int>` — pedido explícito: "moderators can extend
 * deadlines (...) or can give specific days extension with a command, only for a
 * specific match. The match will have an ID for that." El "Match ID" es el id propio
 * de `discord_matchup_threads`, ya publicado en el hilo por announceMatchups.ts
 * (`thread.send({content: \`Match ID: ${tracking.id}\`})`).
 *
 * Gateado con `ManageThreads` — solo moderadores pueden correrlo, registrado
 * guild-scoped en scripts/discordBot.ts.
 */
import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { discordMatchupThreads } from "@/db/schema";
import { discordClient } from "../client";

export const extendCommand = new SlashCommandBuilder()
  .setName("extend")
  .setDescription("Grant a deadline extension to a specific tracked match")
  .addIntegerOption((opt) => opt.setName("match_id").setDescription("Match ID posted in the organizing thread").setRequired(true))
  .addIntegerOption((opt) => opt.setName("days").setDescription("Days to add on top of the current deadline").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads);

export async function handleExtendCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const matchId = interaction.options.getInteger("match_id", true);
  const days = interaction.options.getInteger("days", true);

  const [tracking] = await db.select().from(discordMatchupThreads).where(eq(discordMatchupThreads.id, matchId)).limit(1);
  if (!tracking) {
    await interaction.reply({ content: `No tracked match found with ID ${matchId}.`, ephemeral: true });
    return;
  }

  const [updated] = await db
    .update(discordMatchupThreads)
    .set({
      extensionDays: tracking.extensionDays + days,
      // El plazo efectivo cambia — si ya se había avisado de vencido, puede que ya no
      // lo esté, así que vuelve a entrar en el ciclo normal de recordatorios.
      overdueNotifiedAt: null,
    })
    .where(eq(discordMatchupThreads.id, matchId))
    .returning({ extensionDays: discordMatchupThreads.extensionDays, threadId: discordMatchupThreads.threadId });

  await interaction.reply({
    content: `Match #${matchId} extended by ${days} day(s) — total extension now ${updated.extensionDays} day(s).`,
    ephemeral: true,
  });

  try {
    const thread = await discordClient.channels.fetch(updated.threadId);
    if (thread?.isThread()) await thread.send(`A moderator granted a ${days}-day extension for this match.`);
  } catch {
    // El hilo puede haberse archivado o borrado — la confirmación ya se mandó, esto es solo un aviso extra.
  }
}
