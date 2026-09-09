/**
 * Avisa al propio usuario en Discord en cuanto un admin aprueba su solicitud de ser
 * reportero (`app/admin/news/reporters/actions.ts::approveReporterRequest`, un Server
 * Action que corre en el proceso web, aparte del bot) — mismo patrón exacto que
 * notifyClaimApproved.ts: el bot nunca se entera de la aprobación en el momento,
 * sondea `news_reporter_requests` buscando filas `approved` sin avisar todavía.
 *
 * Mensaje PRIVADO (DM), no un ping en un canal del servidor — mismo criterio que la
 * aprobación de un claim de jugador: es un aviso personal, no algo que interese al
 * resto del servidor.
 */
import { and, eq, isNull } from "drizzle-orm";
import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { db } from "@/db/client";
import { authAccounts, newsReporterRequests } from "@/db/schema";
import { siteBaseUrl } from "@/lib/playerLinks";
import { discordClient } from "../client";

interface ApprovedReporterRow {
  requestId: number;
  userId: string;
}

async function findUnnotifiedApprovals(): Promise<ApprovedReporterRow[]> {
  return db
    .select({ requestId: newsReporterRequests.id, userId: newsReporterRequests.userId })
    .from(newsReporterRequests)
    .where(and(eq(newsReporterRequests.status, "approved"), isNull(newsReporterRequests.notifiedAt)));
}

export async function notifyReporterApproved(): Promise<void> {
  const rows = await findUnnotifiedApprovals();
  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      const [account] = await db
        .select({ providerAccountId: authAccounts.providerAccountId })
        .from(authAccounts)
        .where(and(eq(authAccounts.userId, row.userId), eq(authAccounts.provider, "discord")))
        .limit(1);
      if (!account) continue;

      const user = await discordClient.users.fetch(account.providerAccountId);
      const base = siteBaseUrl();
      const accountLine = base ? `\n${base}/account` : "";
      await user.send(`Your request to become a news reporter has been approved — you can now write your own stories!${accountLine}`);
      await db.update(newsReporterRequests).set({ notifiedAt: new Date() }).where(eq(newsReporterRequests.id, row.requestId));
    } catch (err) {
      console.error(`✗ No se pudo avisar por DM de la aprobación de reportero #${row.requestId}:`, err);
      if (err instanceof DiscordAPIError && err.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
        await db.update(newsReporterRequests).set({ notifiedAt: new Date() }).where(eq(newsReporterRequests.id, row.requestId));
      }
    }
  }
}
