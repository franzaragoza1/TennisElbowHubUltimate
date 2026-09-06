/**
 * Botón "Confirm — {name}" del hilo de organización (ver announceMatchups.ts). Solo
 * cuenta como confirmación si quien pulsa es DE VERDAD ese jugador — se comprueba
 * contra `auth_accounts` (Discord vinculado), nunca se confía en el nombre del botón
 * ni en que el pulsador esté en el hilo correcto.
 */
import { and, eq } from "drizzle-orm";
import type { ButtonInteraction } from "discord.js";
import { db } from "@/db/client";
import { authAccounts, discordMatchupThreads, players } from "@/db/schema";

async function isDiscordAccountOfPlayer(playerId: number, discordUserId: string): Promise<boolean> {
  const [player] = await db.select({ linkedUserId: players.linkedUserId }).from(players).where(eq(players.id, playerId)).limit(1);
  if (!player?.linkedUserId) return false;

  const [account] = await db
    .select({ providerAccountId: authAccounts.providerAccountId })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, player.linkedUserId), eq(authAccounts.provider, "discord")))
    .limit(1);
  return account?.providerAccountId === discordUserId;
}

export async function handleConfirmButton(interaction: ButtonInteraction): Promise<void> {
  const [, trackingIdRaw, playerIdRaw] = interaction.customId.split(":");
  const trackingId = Number(trackingIdRaw);
  const playerId = Number(playerIdRaw);

  const isOwnAccount = await isDiscordAccountOfPlayer(playerId, interaction.user.id);
  if (!isOwnAccount) {
    await interaction.reply({ content: "Only the player themself can confirm this — this isn't your match.", ephemeral: true });
    return;
  }

  const [tracking] = await db.select().from(discordMatchupThreads).where(eq(discordMatchupThreads.id, trackingId)).limit(1);
  if (!tracking) {
    await interaction.reply({ content: "This match is no longer tracked (probably already played or past its deadline).", ephemeral: true });
    return;
  }

  const isPlayer1 = tracking.player1Id === playerId;
  const isPlayer2 = tracking.player2Id === playerId;
  if (!isPlayer1 && !isPlayer2) {
    await interaction.reply({ content: "Something's off — this button doesn't match this thread's tracked match.", ephemeral: true });
    return;
  }

  await db
    .update(discordMatchupThreads)
    .set(isPlayer1 ? { player1ConfirmedAt: new Date() } : { player2ConfirmedAt: new Date() })
    .where(eq(discordMatchupThreads.id, trackingId));

  await interaction.reply({ content: "Confirmed — thanks!", ephemeral: true });
}
