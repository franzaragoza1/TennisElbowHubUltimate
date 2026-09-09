/**
 * Avisa al propio jugador en Discord en cuanto un admin aprueba su solicitud de
 * vinculación de perfil (`app/admin/players/claims/actions.ts::approvePlayerClaim`,
 * un Server Action que corre en el proceso web, aparte del bot — ver
 * scripts/discordBot.ts) — pedido explícito del propietario. El bot nunca se entera
 * de la aprobación en el momento: sondea `player_claim_requests` buscando filas
 * `approved` sin avisar todavía, mismo patrón que `sendReminders.ts` con
 * `discordMatchupThreads.overdueNotifiedAt`.
 *
 * Mensaje PRIVADO (DM), no un ping en un canal del servidor — pedido explícito
 * (antes se publicaba en `DISCORD_CLAIM_APPROVED_CHANNEL_ID`): la aprobación de un
 * claim es un aviso personal para ese jugador, no algo que interese al resto del
 * servidor. Ya no hace falta ningún canal fijo por configuración para esto.
 */
import { and, eq, isNull } from "drizzle-orm";
import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { db } from "@/db/client";
import { authAccounts, players, playerClaimRequests } from "@/db/schema";
import { siteBaseUrl } from "@/lib/playerLinks";
import { discordClient } from "../client";

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
  const rows = await findUnnotifiedApprovals();
  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      // Directo contra `auth_accounts`, no `resolvePlayerLinks` (pensado para el rival
      // de OTRO jugador en un partido) — aquí el propio `userId` de la solicitud YA ES
      // la cuenta a avisar, sin intermediarios.
      const [account] = await db
        .select({ providerAccountId: authAccounts.providerAccountId })
        .from(authAccounts)
        .where(and(eq(authAccounts.userId, row.userId), eq(authAccounts.provider, "discord")))
        .limit(1);
      // No debería pasar nunca de verdad (todo claim viene de una cuenta ya logueada
      // con Discord), pero sin cuenta vinculada no hay a quién mandarle el DM —
      // se deja sin marcar `notifiedAt` para no perder el aviso si algún día se
      // resuelve, aunque en la práctica esto sería un dato inconsistente.
      if (!account) continue;

      const user = await discordClient.users.fetch(account.providerAccountId);
      const base = siteBaseUrl();
      const accountLine = base ? `\n${base}/account` : ""; // sin SITE_URL configurado, un enlace relativo no diría nada fuera del sitio
      await user.send(`Your request to claim **${row.displayName}**'s profile has been approved — welcome to the tour!${accountLine}`);
      await db.update(playerClaimRequests).set({ notifiedAt: new Date() }).where(eq(playerClaimRequests.id, row.claimId));
    } catch (err) {
      console.error(`✗ No se pudo avisar por DM de la aprobación del claim #${row.claimId}:`, err);
      // Solo "DM cerrado" (código 50007, jugador con los mensajes privados
      // restringidos) es un fallo PERMANENTE — reintentar en el siguiente ciclo
      // fallaría exactamente igual para siempre, así que se cuenta como "avisado" de
      // todos modos (no hay forma de forzar el DM). Cualquier OTRO error (red, Discord
      // caído un momento...) es probablemente transitorio: se deja sin marcar
      // `notifiedAt` para que el próximo ciclo lo reintente de verdad.
      if (err instanceof DiscordAPIError && err.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
        await db.update(playerClaimRequests).set({ notifiedAt: new Date() }).where(eq(playerClaimRequests.id, row.claimId));
      }
    }
  }
}
