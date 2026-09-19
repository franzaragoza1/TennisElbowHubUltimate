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
import { getCourtPhysicsForTournament } from "@/lib/courtPhysics";
import { draftNewsStory } from "@/lib/newsGeneration/draft";
import type { PostMatchInterviewCandidate } from "@/lib/newsGeneration/facts";
import { assessInterviewMood, generateNextInterviewQuestion, type InterviewContext, type InterviewQA } from "@/lib/newsGeneration/interviewQuestions";
import { getRecentFormLines } from "@/lib/newsGeneration/recentForm";
import { getOpponentFormTier } from "@/lib/newsGeneration/opponentForm";
import { getNextOpponentLookahead } from "@/lib/nextOpponent";
import { getCurrentRanks } from "@/lib/tourQueries";
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
  surface: string | null;
  year: number;
  isoWeek: number | null;
  roundLabel: string;
  playerName: string;
  opponentName: string;
  playerRank: number | null;
  opponentRank: number | null;
  playerWon: boolean;
  playedAt: Date | null;
}

async function loadMatchContext(row: InterviewRow): Promise<MatchContext> {
  const [match] = await db
    .select({
      eventName: events.displayName,
      category: editions.category,
      surface: editions.surface,
      year: editions.year,
      isoWeek: editions.isoWeek,
      drawSize: editions.drawSize,
      winnerId: matches.winnerId,
      playedAt: matches.playedAt,
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
  const ranks = await getCurrentRanks([row.playerId, row.opponentId]);

  return {
    eventName: match?.eventName ?? "the tournament",
    category: match?.category ?? "250",
    surface: match?.surface ?? null,
    year: match?.year ?? new Date().getFullYear(),
    isoWeek: match?.isoWeek ?? null,
    roundLabel: match ? roundDisplayLabel(fullRoundLadder(match.drawSize), row.round) : row.round,
    playerName: player?.displayName ?? "Player",
    opponentName: opponent?.displayName ?? "their opponent",
    playerRank: ranks.get(row.playerId) ?? null,
    opponentRank: ranks.get(row.opponentId) ?? null,
    playerWon: match ? match.winnerId === row.playerId : false,
    playedAt: match?.playedAt ?? null,
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
      // Enlaza el artículo con el hilo real — la página pública lo usa para enseñar la
      // transcripción completa debajo del cuerpo (pase "Latest", 2026-09-15).
      interviewThreadId: row.id,
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
  const channel = message.channel; // capturado ya con el tipo estrecho de hilo, para que closeInterview() de abajo también pueda usar .send

  const [row] = await db
    .select()
    .from(discordInterviewThreads)
    .where(and(eq(discordInterviewThreads.threadId, channel.id), eq(discordInterviewThreads.status, "in_progress")))
    .limit(1);
  if (!row) return; // no es un hilo de entrevista activo — no hay nada que hacer aquí

  const isOwnAccount = await isDiscordAccountOfPlayer(row.playerId, message.author.id);
  if (!isOwnAccount) return; // otra persona charlando libremente — pedido explícito, se ignora sin más

  if (!row.pendingQuestion) return; // sin pregunta de la IA pendiente (Groq no disponible) — nada que emparejar

  const qa: InterviewQA[] = [...row.qa, { question: row.pendingQuestion, answer: message.content }];
  // Cargado ya aquí, antes del primer `closeInterview` posible (bonusAlreadyUsed más
  // abajo) — hace falta `context.playerName` para la línea de cierre en los tres
  // sitios donde se puede cerrar la entrevista.
  const context = await loadMatchContext(row);

  /**
   * Línea de cierre según el ánimo GENERAL de la entrevista (pedido explícito,
   * 2026-09-19), no un texto fijo — "ladies and gentlemen" para una entrevista
   * divertida, "Alright, thank you" para una normal, un "Thank you" seco para una
   * floja. `assessInterviewMood` cae a `null` en cualquier fallo (sin API key,
   * timeout...) — ahí se usa el cierre neutro de "normal" por defecto, nunca se deja
   * el hilo sin cerrar por esto.
   */
  async function closeInterview(): Promise<void> {
    await db.update(discordInterviewThreads).set({ qa, pendingQuestion: null, status: "completed" }).where(eq(discordInterviewThreads.id, row.id));
    const mood = await assessInterviewMood(qa);
    const line =
      mood === "fun" ? `${context.playerName}, ladies and gentlemen!` : mood === "bad" ? `Thank you, ${context.playerName}.` : `Alright, thank you ${context.playerName}!`;
    await channel.send(line);
    await draftAndPublishNews(row, qa);
  }

  // La pregunta bonus sobre la próxima ronda se hace UNA vez, justo al llegar a
  // MAX_QUESTIONS — si `qa.length` ya la supera es que esta misma respuesta era la
  // suya, y toca cerrar sin más (nunca una segunda pregunta bonus).
  const bonusAlreadyUsed = qa.length > MAX_QUESTIONS;
  if (qa.length >= MAX_QUESTIONS && bonusAlreadyUsed) {
    await closeInterview();
    return;
  }

  const formCutoff = context.playedAt ?? new Date();
  const [playerRecentForm, opponentRecentForm] = await Promise.all([
    getRecentFormLines(row.playerId, formCutoff),
    getRecentFormLines(row.opponentId, formCutoff),
  ]);
  const courtPhysics = getCourtPhysicsForTournament(context.eventName);

  // Pedido explícito, 2026-09-17: una pregunta más sobre la próxima ronda — solo tiene
  // sentido si el jugador GANÓ este partido (quien pierde no sigue en el cuadro) y hay
  // algo real que preguntar. Se calcula aquí, no antes, porque solo hace falta en el
  // instante exacto de decidir la pregunta MAX_QUESTIONS-ésima.
  let nextOpponent: InterviewContext["nextOpponent"];
  if (qa.length >= MAX_QUESTIONS && context.playerWon) {
    const lookahead = await getNextOpponentLookahead(row.playerId, row.editionId);
    if (lookahead.kind === "known") {
      const form = await getOpponentFormTier(lookahead.playerId, formCutoff);
      const formNote = form.tier === "Solid" || form.tier === "Great" ? form.note : null;
      nextOpponent = { kind: "known", name: lookahead.name, formNote };
    } else if (lookahead.kind === "candidates") {
      nextOpponent = { kind: "candidates", names: lookahead.names };
    }
  }

  if (qa.length >= MAX_QUESTIONS && !nextOpponent) {
    // Ganó pero no hay nada real que preguntar sobre la próxima ronda (eliminado,
    // campeón, o el cuadro todavía no da ni un rival conocido ni dos candidatos) —
    // se cierra igual que siempre, sin pregunta bonus.
    await closeInterview();
    return;
  }

  const nextQuestion = await generateNextInterviewQuestion(
    {
      playerName: context.playerName,
      opponentName: context.opponentName,
      playerRank: context.playerRank,
      opponentRank: context.opponentRank,
      scoreRaw: row.scoreRaw,
      roundLabel: context.roundLabel,
      eventName: context.eventName,
      tournamentCategory: context.category,
      tournamentSurface: context.surface,
      courtPaceIndex: courtPhysics?.courtPaceIndex ?? null,
      speedCategory: courtPhysics?.speedCategory ?? null,
      playerWon: context.playerWon,
      playerRecentForm,
      opponentRecentForm,
      nextOpponent,
    },
    qa,
  );

  if (!nextQuestion) {
    // La IA no responde — se cierra igual con lo que ya se tiene en vez de dejar el
    // hilo esperando una pregunta que nunca llega.
    await closeInterview();
    return;
  }

  await db.update(discordInterviewThreads).set({ qa, pendingQuestion: nextQuestion.question }).where(eq(discordInterviewThreads.id, row.id));
  // Pedido explícito: el jugador tiene que enterarse de cada pregunta, no solo la
  // primera (interviewButton.ts ya pinga esa) — el hilo permite "hablar libremente" a
  // cualquiera, así que sin esto una pregunta nueva se pierde fácilmente entre otros
  // mensajes. `isOwnAccount` ya confirmó que `message.author.id` es de verdad este
  // jugador, así que es su snowflake real, no hace falta resolverlo aparte.
  // `crowdReaction` (pedido explícito, 2026-09-19) es ambiente puro para ESTE mensaje
  // — en cursiva, en su propia línea, nunca guardado en `qa`/`pendingQuestion`.
  const reactionLine = nextQuestion.crowdReaction ? `_${nextQuestion.crowdReaction}_\n` : "";
  await channel.send(`${reactionLine}<@${message.author.id}> ${nextQuestion.question}`);
}
