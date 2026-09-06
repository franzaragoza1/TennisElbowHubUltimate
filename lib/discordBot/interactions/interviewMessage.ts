/**
 * Escucha `messageCreate` en los hilos de entrevista abiertos por interviewButton.ts.
 * Pedido explícito: "Other users can also talk freely in that thread" — un mensaje de
 * cualquiera que no sea el propio jugador entrevistado simplemente se ignora, nunca es
 * un error. Máximo 3 preguntas (contadas aquí, nunca confiado al modelo), y al
 * completarse alimenta el generador de noticias existente con las respuestas reales.
 */
import type { Message } from "discord.js";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts, discordInterviewThreads, editions, events, matches, news, newsPlayers, players } from "@/db/schema";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { draftNewsStory } from "@/lib/newsGeneration/draft";
import type { PostMatchInterviewCandidate } from "@/lib/newsGeneration/facts";
import { generateNextInterviewQuestion, type InterviewQA } from "@/lib/newsGeneration/interviewQuestions";
import { getTakenSlugs, slugify, uniqueSlug } from "@/lib/newsGeneration/slug";

const MAX_QUESTIONS = 3;

interface InterviewRow {
  id: number;
  editionId: number;
  round: string;
  playerId: number;
  opponentId: number;
  scoreRaw: string | null;
  qa: InterviewQA[];
}

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

interface MatchContext {
  eventName: string;
  category: string;
  year: number;
  isoWeek: number | null;
  roundLabel: string;
  playerName: string;
  opponentName: string;
  playerWon: boolean;
}

async function loadMatchContext(row: InterviewRow): Promise<MatchContext> {
  const [match] = await db
    .select({
      eventName: events.displayName,
      category: editions.category,
      year: editions.year,
      isoWeek: editions.isoWeek,
      drawSize: editions.drawSize,
      winnerId: matches.winnerId,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(
      and(
        eq(matches.editionId, row.editionId),
        eq(matches.round, row.round),
        // Pareja SIN ORDENAR — mismo motivo que en announceResults.ts/interviewButton.ts.
        or(
          and(eq(matches.player1Id, row.playerId), eq(matches.player2Id, row.opponentId)),
          and(eq(matches.player1Id, row.opponentId), eq(matches.player2Id, row.playerId)),
        ),
      ),
    )
    .limit(1);

  const [player] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, row.playerId)).limit(1);
  const [opponent] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, row.opponentId)).limit(1);

  return {
    eventName: match?.eventName ?? "the tournament",
    category: match?.category ?? "250",
    year: match?.year ?? new Date().getFullYear(),
    isoWeek: match?.isoWeek ?? null,
    roundLabel: match ? roundDisplayLabel(fullRoundLadder(match.drawSize), row.round) : row.round,
    playerName: player?.displayName ?? "Player",
    opponentName: opponent?.displayName ?? "their opponent",
    playerWon: match ? match.winnerId === row.playerId : false,
  };
}

async function draftAndPublishNews(row: InterviewRow, qa: InterviewQA[]): Promise<void> {
  const ctx = await loadMatchContext(row);
  const facts: PostMatchInterviewCandidate = {
    kind: "post_match_interview",
    autoKey: `interview-${row.editionId}-${row.round}-${row.playerId}`,
    editionId: row.editionId,
    eventName: ctx.eventName,
    category: ctx.category,
    year: ctx.year,
    isoWeek: ctx.isoWeek,
    round: row.round,
    playerId: row.playerId,
    playerName: ctx.playerName,
    opponentId: row.opponentId,
    opponentName: ctx.opponentName,
    playerWon: ctx.playerWon,
    scoreRaw: row.scoreRaw,
    qa,
  };

  const draft = await draftNewsStory(facts);
  if (!draft) return; // falla en silencio, igual que el resto de lib/newsGeneration — sin borrador, no pasa nada más

  const takenSlugs = await getTakenSlugs();
  const slug = await uniqueSlug(slugify(draft.title), takenSlugs);

  const [inserted] = await db
    .insert(news)
    .values({
      slug,
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      category: draft.category,
      editionId: draft.editionId,
      status: "draft", // nunca se autopublica — mismo criterio que app/admin/news/actions.ts
      autoKey: facts.autoKey,
    })
    .onConflictDoNothing({ target: news.autoKey })
    .returning({ id: news.id });
  if (!inserted) return;

  if (draft.taggedPlayerIds.length > 0) {
    await db.insert(newsPlayers).values(draft.taggedPlayerIds.map((playerId) => ({ newsId: inserted.id, playerId })));
  }
}

export async function handleInterviewMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.channel.isThread()) return;

  const [row] = await db
    .select()
    .from(discordInterviewThreads)
    .where(and(eq(discordInterviewThreads.threadId, message.channel.id), eq(discordInterviewThreads.status, "in_progress")))
    .limit(1);
  if (!row) return; // no es un hilo de entrevista activo — no hay nada que hacer aquí

  const isOwnAccount = await isDiscordAccountOfPlayer(row.playerId, message.author.id);
  if (!isOwnAccount) return; // otra persona charlando libremente — pedido explícito, se ignora sin más

  if (!row.pendingQuestion) return; // sin pregunta de la IA pendiente (Groq no disponible) — nada que emparejar

  const qa: InterviewQA[] = [...row.qa, { question: row.pendingQuestion, answer: message.content }];

  if (qa.length >= MAX_QUESTIONS) {
    await db.update(discordInterviewThreads).set({ qa, pendingQuestion: null, status: "completed" }).where(eq(discordInterviewThreads.id, row.id));
    await message.channel.send("Thanks for chatting — that wraps up the interview! This might turn into a news story soon.");
    await draftAndPublishNews(row, qa);
    return;
  }

  const context = await loadMatchContext(row);
  const nextQuestion = await generateNextInterviewQuestion(
    { playerName: context.playerName, opponentName: context.opponentName, scoreRaw: row.scoreRaw, roundLabel: context.roundLabel, eventName: context.eventName, playerWon: context.playerWon },
    qa,
  );

  if (!nextQuestion) {
    // La IA no responde — se cierra igual con lo que ya se tiene en vez de dejar el
    // hilo esperando una pregunta que nunca llega.
    await db.update(discordInterviewThreads).set({ qa, pendingQuestion: null, status: "completed" }).where(eq(discordInterviewThreads.id, row.id));
    await message.channel.send("Thanks for chatting!");
    await draftAndPublishNews(row, qa);
    return;
  }

  await db.update(discordInterviewThreads).set({ qa, pendingQuestion: nextQuestion }).where(eq(discordInterviewThreads.id, row.id));
  await message.channel.send(nextQuestion);
}
