/**
 * Escucha `messageCreate` en los hilos de "organiza tu partido" (announceMatchups.ts)
 * para saber si el partido se ha discutido de verdad — pedido explícito del
 * propietario, 2026-09-27: el tablero de moderadores (moderatorDeadlines.ts) necesita
 * distinguir "nadie ha dicho nada" de "ya están hablando, dales tiempo". Solo cuenta un
 * mensaje de uno de los DOS JUGADORES (su cuenta de Discord vinculada) — alguien más
 * charlando en el hilo no significa que el partido esté organizado, mismo criterio que
 * `isDiscordAccountOfPlayer` en interviewMessage.ts (duplicado a propósito, mismo
 * motivo: no vale la pena una dependencia cruzada por una comprobación de 3 líneas).
 */
import type { Message } from "discord.js";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts, discordMatchupThreads, players } from "@/db/schema";

export async function handleMatchupThreadMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.channel.isThread()) return;

  const [tracking] = await db
    .select({ id: discordMatchupThreads.id, player1Id: discordMatchupThreads.player1Id, player2Id: discordMatchupThreads.player2Id })
    .from(discordMatchupThreads)
    .where(eq(discordMatchupThreads.threadId, message.channel.id))
    .limit(1);
  if (!tracking) return; // no es un hilo de partido activo — no hay nada que hacer aquí

  // Sin pasar por `lib/auth.ts` a propósito — arrastra `next/navigation`/NextAuth, que
  // no tiene sentido cargar en el proceso del bot (nunca corre dentro de Next.js).
  const [account] = await db
    .select({ playerId: players.id })
    .from(authAccounts)
    .innerJoin(players, eq(players.linkedUserId, authAccounts.userId))
    .where(
      and(
        eq(authAccounts.provider, "discord"),
        eq(authAccounts.providerAccountId, message.author.id),
        or(eq(players.id, tracking.player1Id), eq(players.id, tracking.player2Id)),
      ),
    )
    .limit(1);
  if (!account) return; // quien escribió no es ninguno de los dos jugadores de este partido

  await db.update(discordMatchupThreads).set({ lastActivityAt: new Date() }).where(eq(discordMatchupThreads.id, tracking.id));
}
