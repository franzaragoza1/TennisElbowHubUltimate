/**
 * `/void-match match_id:<int> reason:<text?>` — pedido explícito del propietario,
 * 2026-09-27, tras tener que arreglar a mano un emparejamiento anunciado por error
 * (Sale93 vs Keil en Ningbo: Keil perdió su Round 1 por descalificación, así que quien
 * de verdad llegó a cuartos fue su rival, nunca Keil — el hilo/aviso se creó sobre una
 * pareja que nunca debía existir): "need a way to manage better these type of issues
 * (wrong matches to get created, without always me relying on you)".
 *
 * Hace exactamente lo que se hizo a mano aquella vez: avisa en el hilo de que se anula
 * (con el motivo si se da uno, genérico si no), lo bloquea y archiva (nunca se borra —
 * puede haber conversación real de por medio, como la hubo esa vez) y borra la fila de
 * seguimiento (`discord_matchup_threads`) para que deje de salir en recordatorios, el
 * tablero de moderadores y `/extend`. Mismo "Match ID" que usa `/extend`, mismo gate de
 * permisos (`ManageThreads`).
 */
import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { discordMatchupThreads, players } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { discordClient } from "../client";

export const voidMatchCommand = new SlashCommandBuilder()
  .setName("void-match")
  .setDescription("Cancel a tracked match that should never have been announced (wrong pairing, bad bracket data, etc.)")
  .addIntegerOption((opt) => opt.setName("match_id").setDescription("Match ID posted in the organizing thread").setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Why this match is being voided — posted in the thread for both players to see").setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads);

export async function handleVoidMatchCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const matchId = interaction.options.getInteger("match_id", true);
  const reason = interaction.options.getString("reason");

  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const [tracking] = await db
    .select({ threadId: discordMatchupThreads.threadId, player1Name: p1.displayName, player2Name: p2.displayName })
    .from(discordMatchupThreads)
    .innerJoin(p1, eq(p1.id, discordMatchupThreads.player1Id))
    .innerJoin(p2, eq(p2.id, discordMatchupThreads.player2Id))
    .where(eq(discordMatchupThreads.id, matchId))
    .limit(1);
  if (!tracking) {
    await interaction.reply({ content: `No tracked match found with ID ${matchId}.`, ephemeral: true });
    return;
  }

  // La fila se borra pase lo que pase con el hilo de Discord (archivado ya, borrado a
  // mano, permisos...) — mismo criterio que closeMatchupThread en announceResults.ts:
  // el estado de nuestro lado (recordatorios, tablero, /extend) no puede quedar
  // enganchado a que una llamada a la API de Discord tenga éxito.
  try {
    const thread = await discordClient.channels.fetch(tracking.threadId);
    if (thread?.isThread()) {
      await thread.send(
        `🚫 This match has been voided by a moderator${reason ? `: ${reason}` : "."} — closing the organizing thread, there's nothing to play here.`,
      );
      // Los dos campos en UNA sola petición, nunca dos `setLocked`/`setArchived`
      // seguidos — Discord exige el permiso REAL `Manage Threads` (no basta con ser
      // el dueño del hilo, que es lo que de sobra basta para la PRIMERA petición) para
      // tocar `archived` en un hilo que YA está bloqueado; con dos peticiones
      // seguidas, la segunda puede fallar en silencio (bug real encontrado
      // 2026-09-27 probando esto en el servidor de pruebas: el hilo se quedaba
      // bloqueado pero sin archivar) según los permisos exactos del bot en ese
      // servidor. Con las dos a la vez, Discord las evalúa contra el estado ANTERIOR
      // (todavía sin bloquear), donde ser el dueño del hilo ya basta para las dos.
      await thread.edit({ locked: true, archived: true }).catch(() => {});
    }
  } finally {
    await db.delete(discordMatchupThreads).where(eq(discordMatchupThreads.id, matchId));
  }

  await interaction.reply({
    content: `Match #${matchId} (${tracking.player1Name} vs ${tracking.player2Name}) voided and removed from tracking.`,
    ephemeral: true,
  });
}
