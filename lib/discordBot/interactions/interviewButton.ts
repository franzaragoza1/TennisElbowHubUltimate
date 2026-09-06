/**
 * Botón "Interview me — {name}" del anuncio de resultado (ver announceResults.ts).
 * Crea un hilo PROPIO para ese jugador (nunca el mismo hilo para los dos — pedido
 * explícito: "creating a thread for each player of that match") y lanza la primera
 * pregunta de la IA. `channel.threads.create` en vez de `message.startThread`: un
 * mensaje de Discord solo admite UN hilo colgando de él, y aquí puede haber dos
 * entrevistas (una por jugador) saliendo del mismo mensaje de resultado.
 */
import { ChannelType, type ButtonInteraction } from "discord.js";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts, discordInterviewThreads, editions, events, matches, players } from "@/db/schema";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { generateNextInterviewQuestion } from "@/lib/newsGeneration/interviewQuestions";
import { getRecentFormLines } from "@/lib/newsGeneration/recentForm";

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

export async function handleInterviewButton(interaction: ButtonInteraction): Promise<void> {
  // Diferido lo primero de todo, antes de cualquier consulta — Discord exige una
  // respuesta a la interacción en 3 segundos o el botón muestra "The application
  // didn't respond in time" (visto en producción). Aquí hay de sobra que puede
  // superar eso de sobra: varias consultas, crear un hilo de verdad, y sobre todo la
  // llamada a Groq (`generateNextInterviewQuestion`, hasta 8s de timeout). `deferReply`
  // extiende el plazo a 15 minutos; cada `reply(...)` de abajo pasa a ser
  // `editReply(...)` sobre esa misma respuesta ya diferida.
  await interaction.deferReply({ ephemeral: true });

  const [, editionIdRaw, round, playerIdRaw, opponentIdRaw] = interaction.customId.split(":");
  const editionId = Number(editionIdRaw);
  const playerId = Number(playerIdRaw);
  const opponentId = Number(opponentIdRaw);

  const isOwnAccount = await isDiscordAccountOfPlayer(playerId, interaction.user.id);
  if (!isOwnAccount) {
    await interaction.editReply({ content: "Only the player themself can start their own interview." });
    return;
  }

  const [existing] = await db
    .select({ threadId: discordInterviewThreads.threadId })
    .from(discordInterviewThreads)
    .where(and(eq(discordInterviewThreads.editionId, editionId), eq(discordInterviewThreads.round, round), eq(discordInterviewThreads.playerId, playerId)))
    .limit(1);
  if (existing) {
    await interaction.editReply({ content: `You've already started this one: <#${existing.threadId}>` });
    return;
  }

  const [match] = await db
    .select({
      drawSize: editions.drawSize,
      eventName: events.displayName,
      scoreRaw: matches.scoreRaw,
      winnerId: matches.winnerId,
      playedAt: matches.playedAt,
      playerName: players.displayName,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(players, eq(players.id, playerId))
    .where(
      and(
        eq(matches.editionId, editionId),
        eq(matches.round, round),
        // Pareja SIN ORDENAR a propósito — mismo motivo que sendReminders.ts: no hay
        // garantía de qué lado quedó como "player1" en la fila ya decidida.
        or(
          and(eq(matches.player1Id, playerId), eq(matches.player2Id, opponentId)),
          and(eq(matches.player1Id, opponentId), eq(matches.player2Id, playerId)),
        ),
      ),
    )
    .limit(1);
  if (!match) {
    await interaction.editReply({ content: "Couldn't find this match anymore — sorry!" });
    return;
  }

  const [opponent] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, opponentId)).limit(1);

  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply({ content: "Something's off with this channel — couldn't start the interview." });
    return;
  }

  const thread = await channel.threads.create({
    name: `Interview: ${match.playerName}`,
    autoArchiveDuration: 1440, // 24h — una entrevista se hace o no se hace de un tirón, no hace falta el máximo
    type: ChannelType.PublicThread,
  });

  const roundLabel = roundDisplayLabel(fullRoundLadder(match.drawSize), round);
  // Antes de este partido, nunca posteriores — evita que la IA "vea" el propio partido
  // de la entrevista como si fuera forma pasada.
  const formCutoff = match.playedAt ?? new Date();
  const [playerRecentForm, opponentRecentForm] = await Promise.all([
    getRecentFormLines(playerId, formCutoff),
    getRecentFormLines(opponentId, formCutoff),
  ]);
  const context = {
    playerName: match.playerName,
    opponentName: opponent?.displayName ?? "their opponent",
    scoreRaw: match.scoreRaw,
    roundLabel,
    eventName: match.eventName,
    playerWon: match.winnerId === playerId,
    playerRecentForm,
    opponentRecentForm,
  };

  const firstQuestion = await generateNextInterviewQuestion(context, []);

  await db.insert(discordInterviewThreads).values({
    editionId,
    round,
    playerId,
    opponentId,
    scoreRaw: match.scoreRaw,
    threadId: thread.id,
    status: "in_progress",
    qa: [],
    pendingQuestion: firstQuestion,
  });

  // `isOwnAccount` ya confirmó que quien pulsó el botón es este mismo jugador — su
  // snowflake de Discord es directamente `interaction.user.id`, no hace falta
  // resolverlo otra vez.
  const mention = `<@${interaction.user.id}>`;
  await thread.send(
    firstQuestion
      ? `${mention} thanks for joining! ${firstQuestion}`
      : `${mention} thanks for joining! Tell us how you're feeling about that match.`,
  );

  await interaction.editReply({ content: `Interview started: <#${thread.id}>` });
}
