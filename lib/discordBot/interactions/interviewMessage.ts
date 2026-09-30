/**
 * Escucha `messageCreate` en los hilos de entrevista abiertos por interviewButton.ts.
 * Pedido explícito: "Other users can also talk freely in that thread" — un mensaje de
 * cualquiera que no sea el propio jugador entrevistado simplemente se ignora, nunca es
 * un error. Al completarse alimenta el generador de noticias existente con las
 * respuestas reales.
 *
 * La duración YA NO es un número fijo de preguntas (pedido explícito del propietario,
 * 2026-09-20, con capturas reales de Discord como prueba): forzar exactamente 3-4
 * preguntas pasara lo que pasara en la conversación era justo lo que se sentía
 * robótico — el bot ignoraba por completo que el jugador se había desviado a bromear
 * sobre comida china y volvía a su siguiente pregunta programada como si nada. Ahora
 * es el propio modelo quien decide cuándo la entrevista llega a un cierre natural
 * (`generateNextInterviewQuestion` devolviendo `question: null`, ver
 * lib/newsGeneration/interviewQuestions.ts) — `MAX_QUESTIONS_SAFETY_CAP` de abajo es
 * solo un techo de seguridad en código, nunca el objetivo a alcanzar.
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

// Nunca el objetivo, solo una protección ante un modelo que no decidiera parar solo
// (fallo de generación repetido, o simplemente no respetando la instrucción del
// prompt) — sin esto una entrevista rota podría seguir pidiendo preguntas para
// siempre.
const MAX_QUESTIONS_SAFETY_CAP = 6;

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
   *
   * Bug real reportado, 2026-09-23: con un handle largo del tour ("Alright, thank you
   * minatonamikaze1643!") esta línea se veía torpe — mientras que cada PREGUNTA de la
   * entrevista (interviewButton.ts, y más abajo en este mismo fichero) ya se dirige al
   * jugador con una mención `<@id>` de Discord, nunca con `context.playerName`. Un
   * mention no tiene ese problema de raíz: Discord lo enseña como el apodo/nombre de
   * servidor de la persona (normalmente mucho más corto que su handle del tour) en vez
   * del texto crudo — así que el cierre ahora usa la MISMA mención que ya usa el resto
   * del hilo, en vez de inventar una lógica de abreviar nombres aparte.
   */
  async function closeInterview(): Promise<void> {
    await db.update(discordInterviewThreads).set({ qa, pendingQuestion: null, status: "completed" }).where(eq(discordInterviewThreads.id, row.id));
    const mood = await assessInterviewMood(qa);
    const mention = `<@${message.author.id}>`;
    const line = mood === "fun" ? `${mention}, ladies and gentlemen!` : mood === "bad" ? `Thank you, ${mention}.` : `Alright, thank you ${mention}!`;
    await channel.send(line);
    await draftAndPublishNews(row, qa);
  }

  // La pregunta bonus sobre el rival de la siguiente ronda se hace UNA sola vez — si
  // la que se acaba de responder era esa, toca cerrar sin más (nunca una segunda de
  // seguimiento). `nextOpponentAsked` (no un recuento) es lo único que lo recuerda:
  // ver el comentario de esa columna en db/schema.ts.
  if (row.nextOpponentAsked) {
    await closeInterview();
    return;
  }

  const hitSafetyCap = qa.length >= MAX_QUESTIONS_SAFETY_CAP;

  const formCutoff = context.playedAt ?? new Date();
  const [playerRecentForm, opponentRecentForm] = await Promise.all([
    getRecentFormLines(row.playerId, formCutoff),
    getRecentFormLines(row.opponentId, formCutoff),
  ]);
  const courtPhysics = getCourtPhysicsForTournament(context.eventName);

  // Pedido explícito, 2026-09-17: una pregunta más sobre la próxima ronda — solo tiene
  // sentido si el jugador GANÓ este partido (quien pierde no sigue en el cuadro) y hay
  // algo real que preguntar. `MIN_QUESTIONS_BEFORE_BONUS` evita ofrecerla demasiado
  // pronto (el prompt la fuerza como la ÚNICA pregunta posible en cuanto está
  // presente, así que aparecer en la 2ª pregunta cortaría la entrevista en seco) —
  // fuera de eso ya no depende de un recuento exacto, solo de haber tenido ya un par
  // de intercambios reales, o de haber llegado al techo de seguridad.
  const MIN_QUESTIONS_BEFORE_BONUS = 2;
  let nextOpponent: InterviewContext["nextOpponent"];
  if ((qa.length >= MIN_QUESTIONS_BEFORE_BONUS || hitSafetyCap) && context.playerWon) {
    const lookahead = await getNextOpponentLookahead(row.playerId, row.editionId);
    if (lookahead.kind === "known") {
      const form = await getOpponentFormTier(lookahead.playerId, formCutoff);
      const formNote = form.tier === "Solid" || form.tier === "Great" ? form.note : null;
      // Su partido más reciente de verdad (resultado, ronda, rival) — bug real
      // reportado, 2026-09-30: sin ningún dato real de cómo llegó ese rival hasta
      // aquí, el modelo se lo inventaba entero ("after his walkover win over Hardy13",
      // ni el rival ni el tipo de victoria eran reales). Dándole el dato de verdad se
      // le quita la tentación — y el prompt además se lo prohíbe explícitamente.
      const [recentResult = null] = await getRecentFormLines(lookahead.playerId, formCutoff, 1);
      nextOpponent = { kind: "known", name: lookahead.name, formNote, recentResult };
    } else if (lookahead.kind === "candidates") {
      nextOpponent = { kind: "candidates", names: lookahead.names };
    }
  }

  if (hitSafetyCap && !nextOpponent) {
    // Techo de seguridad alcanzado y no hay pregunta bonus que ofrecer — se cierra ya,
    // en vez de seguir insistiendo en que el modelo decida parar solo.
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

  if (!nextQuestion || nextQuestion.question === null) {
    // Sin respuesta de la IA, o el propio modelo decidiendo que la entrevista ya
    // llegó a un cierre natural (pedido explícito, 2026-09-20) — se cierra igual con
    // lo que ya se tiene en vez de dejar el hilo esperando una pregunta que nunca
    // llega, o forzar una que el modelo ya juzgó innecesaria.
    await closeInterview();
    return;
  }

  await db
    .update(discordInterviewThreads)
    .set({ qa, pendingQuestion: nextQuestion.question, nextOpponentAsked: row.nextOpponentAsked || Boolean(nextOpponent) })
    .where(eq(discordInterviewThreads.id, row.id));
  // Pedido explícito: el jugador tiene que enterarse de cada pregunta, no solo la
  // primera (interviewButton.ts ya pinga esa) — el hilo permite "hablar libremente" a
  // cualquiera, así que sin esto una pregunta nueva se pierde fácilmente entre otros
  // mensajes. `isOwnAccount` ya confirmó que `message.author.id` es de verdad este
  // jugador, así que es su snowflake real, no hace falta resolverlo aparte.
  // `crowdReaction` (pedido explícito, 2026-09-19) es ambiente puro para ESTE mensaje
  // — nunca guardado en `qa`/`pendingQuestion`. Entre llaves y en cursiva (pedido
  // explícito, 2026-09-20: "the bot should say '{Crowd Applauses}' or something
  // similar") — una línea de texto normal se perdía entre el resto del mensaje, esto
  // se lee de un vistazo como acotación de escena, no como parte de lo que dice nadie.
  const reactionLine = nextQuestion.crowdReaction ? `*{${nextQuestion.crowdReaction}}*\n` : "";
  await channel.send(`${reactionLine}<@${message.author.id}> ${nextQuestion.question}`);
}
