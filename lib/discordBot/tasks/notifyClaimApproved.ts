/**
 * Avisa al propio jugador en Discord en cuanto un admin aprueba su solicitud de
 * vinculación de perfil (`app/admin/players/claims/actions.ts::approvePlayerClaim`,
 * un Server Action que corre en el proceso web, aparte del bot — ver
 * scripts/discordBot.ts) — pedido explícito del propietario. El bot nunca se entera
 * de la aprobación en el momento: sondea `player_claim_requests` buscando filas
 * `approved` sin avisar todavía, mismo patrón que `sendReminders.ts` con
 * `discordMatchupThreads.overdueNotifiedAt`.
 *
 * Canal fijo por configuración (`DISCORD_CLAIM_APPROVED_CHANNEL_ID`, opcional — ver
 * roleConfig.ts para el mismo criterio): mientras no esté puesto, esta tarea
 * simplemente no hace nada en cada ciclo, nunca tira abajo el resto del bot.
 */
import { and, eq, isNull } from "drizzle-orm";
import { ChannelType } from "discord.js";
import { db } from "@/db/client";
import { authAccounts, players, playerClaimRequests } from "@/db/schema";
import { discordClient } from "../client";
import { discordBotConfig } from "../config";

interface ApprovedClaimRow {
  claimId: number;
  userId: string;
  playerId: number;
  displayName: string;
}

async function findUnnotifiedApprovals(): Promise<ApprovedClaimRow[]> {
  return db
    .select({
      claimId: playerClaimRequests.id,
      userId: playerClaimRequests.userId,
      playerId: playerClaimRequests.playerId,
      displayName: players.displayName,
    })
    .from(playerClaimRequests)
    .innerJoin(players, eq(players.id, playerClaimRequests.playerId))
    .where(and(eq(playerClaimRequests.status, "approved"), isNull(playerClaimRequests.notifiedAt)));
}

export async function notifyClaimApproved(): Promise<void> {
  if (!discordBotConfig.claimApprovedChannelId) return;

  const rows = await findUnnotifiedApprovals();
  if (rows.length === 0) return;

  const channel = await discordClient.channels.fetch(discordBotConfig.claimApprovedChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  for (const row of rows) {
    try {
      // Directo contra `auth_accounts`, no `resolvePlayerLinks` (pensado para el rival
      // de OTRO jugador en un partido) — aquí el propio `userId` de la solicitud YA ES
      // la cuenta a pingar, sin intermediarios.
      const [account] = await db
        .select({ providerAccountId: authAccounts.providerAccountId })
        .from(authAccounts)
        .where(and(eq(authAccounts.userId, row.userId), eq(authAccounts.provider, "discord")))
        .limit(1);

      const mention = account ? `<@${account.providerAccountId}>` : `**${row.displayName}**`;
      await channel.send(`${mention} your request to claim **${row.displayName}**'s profile has been approved — welcome to the tour!`);
      await db.update(playerClaimRequests).set({ notifiedAt: new Date() }).where(eq(playerClaimRequests.id, row.claimId));
    } catch (err) {
      console.error(`✗ No se pudo avisar de la aprobación del claim #${row.claimId}:`, err);
    }
  }
}
