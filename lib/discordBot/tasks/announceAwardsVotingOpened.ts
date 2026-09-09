/**
 * Publica la votación en cuanto un período de premios pasa a 'voting'
 * (app/admin/awards/actions.ts::openVoting). Idempotencia en DOS niveles, no uno:
 * `announcedOpenAt` (período entero) decide si el mensaje de cabecera con el discurso
 * ya salió, pero cada CATEGORÍA se comprueba aparte por si ya tiene sondeo publicado
 * (`discordPollMessageId` puesto en sus nominados) — así que esta tarea sigue mirando
 * TODO período en 'voting' en cada ciclo, no solo los recién abiertos.
 *
 * Motivo real: Point of the Month depende de envíos de jugador que empiezan en
 * 'pending' y el admin puede aprobar en cualquier momento (app/admin/awards/
 * actions.ts::approvePendingSubmission) — incluso después de abrir la votación, si
 * se le pasó revisar la cola antes de pulsar "Open voting" (bug real reportado: "point
 * of the month poll didn't get sent after opening votes" — la categoría se quedó sin
 * nominados aprobados en el momento de abrir, y sin este segundo nivel de
 * idempotencia nunca habría una segunda oportunidad de publicar SU sondeo una vez
 * aprobado el envío, porque `announcedOpenAt` del período ya estaba sellado).
 *
 * El voto de verdad pasa en Discord, no en el sitio — pedido explícito del
 * propietario: "the poll must be on discord, then the bot reads results when it gets
 * closed and posts on the website". Un mensaje con sondeo real por CATEGORÍA (Discord
 * solo admite un sondeo por mensaje): el discurso del admin va en un mensaje de
 * cabecera aparte, y cada categoría lleva su detalle completo (nombre, marcador, clip)
 * como texto del mensaje y sus nominados como respuestas votables del sondeo — el
 * texto de una respuesta de sondeo tiene un límite real de Discord (55 caracteres),
 * muy por debajo de lo que ocupa "P1 (P1 vs P2 — Evento Año (Ronda)) — 6/3 6/2", así
 * que las respuestas usan una etiqueta corta (ver `pollAnswerLabel`) mientras el
 * mensaje de texto lleva el detalle completo para decidir el voto.
 *
 * El mensaje de cada categoría se guarda en `discordPollMessageId` sobre TODOS sus
 * nominados (lib/discordBot/tasks/syncAwardsPollResults.ts lo necesita para leer el
 * recuento al cerrarse, y la página pública para enlazar al sondeo).
 *
 * El discurso se escribe con el editor de texto enriquecido de la web
 * (components/admin/RichTextEditor.tsx, HTML de verdad) y se traduce a Markdown de
 * Discord real (lib/richText.ts::htmlToDiscordMarkdown) — pedido explícito del
 * propietario, "must be compatible with the discord messages too": nunca HTML/CSS en
 * crudo dentro del mensaje, y el color de texto (que Discord no soporta) se pierde
 * limpiamente en vez de dejar basura. El mensaje de cabecera se manda como CONTENIDO
 * normal, no como embed — pedido explícito, "in the speech admins can tag, either
 * roles or everyone": un embed nunca dispara una mención de verdad, así que hace
 * falta texto normal para que un @everyone o un rol pingue (ver
 * chunkForDiscordContent para el límite de 2000 caracteres de un mensaje normal).
 *
 * `DISCORD_AWARDS_CHANNEL_ID` es opcional, a diferencia de los canales de toda la vida
 * en lib/discordBot/config.ts (matchups/results) — Awards es una función nueva que no
 * puede tirar abajo el resto del bot si todavía no se ha configurado, así que se lee
 * directo de `process.env` aquí y la tarea entera se salta sin más si falta.
 */
import { ChannelType, EmbedBuilder, type PollData, type TextChannel } from "discord.js";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { awardNominations, awardPeriods } from "@/db/schema";
import { categoriesForCycle, type AwardCategory, type AwardCycle } from "@/lib/awards/catalog";
import { matchupOnly, periodLabel } from "@/lib/awards/format";
import { getNominationsForPeriod, type AwardPeriodRow, type NominationDisplay } from "@/lib/awards/queries";
import { htmlToDiscordMarkdown, toEditorContent } from "@/lib/richText";
import { siteBaseUrl } from "@/lib/playerLinks";
import { discordClient } from "../client";

// Duración fija del sondeo — mismo margen que llevaban a mano los sondeos manuales de
// antes de esta función (ver la captura "MONTHLY AWARDS VOTING" de Discord). El admin
// puede cerrarlo antes desde el sitio (app/admin/awards/actions.ts::closeVoting) si
// hace falta.
const POLL_DURATION_HOURS = 7 * 24;

// Límite real de Discord para el texto de una respuesta de sondeo.
const POLL_ANSWER_MAX_LENGTH = 55;

// Margen bajo el límite real de un mensaje normal (2000 caracteres) — un discurso que
// lo supere se reparte en varios mensajes seguidos (ver chunkForDiscordContent) en vez
// de volver a un embed: un embed NUNCA dispara una mención de verdad (ni de rol ni
// @everyone, ver el comentario de announceOnePeriodOpened), así que esto es el precio
// de poder pingar de verdad desde el discurso.
const DISCORD_CONTENT_MAX_LENGTH = 1900;

function chunkForDiscordContent(text: string): string[] {
  if (text.length <= DISCORD_CONTENT_MAX_LENGTH) return [text];
  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length > DISCORD_CONTENT_MAX_LENGTH) {
      if (current) chunks.push(current);
      current = p.length > DISCORD_CONTENT_MAX_LENGTH ? p.slice(0, DISCORD_CONTENT_MAX_LENGTH) : p;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// "P1 vs P2 — Event Year (Round)" -> "P1 vs P2", con el NOMINADO primero — `matchLabel`
// viene de player1/player2 de `matches` en el orden que sea (no necesariamente quien
// ganó), así que sin esto un vuelco podía leerse "Perdedor vs Ganador" (bug real
// reportado con capturas: "mohd lost, not won, so show winner first" — para Upset of
// the Month el nominado ES quien ganó el vuelco, así que "nominado primero" es
// exactamente "ganador primero" ahí).
function orderedMatchup(playerName: string, matchLabel: string): string {
  const core = matchupOnly(matchLabel);
  const [p1, p2] = core.split(" vs ");
  return p2 === playerName ? `${p2} vs ${p1}` : core;
}

// Para nomineeKind 'match' (Match of the Month/Year): el orden de nombres en
// `matchLabel` es el de player1/player2 tal cual están en la base, no necesariamente
// quién ganó — y `scoreRaw` SIEMPRE lleva las games del GANADOR primero en cada set
// (ver el comentario de scoreFromPerspective en lib/matchScore.ts), así que mostrar
// los nombres en el orden equivocado atribuye el marcador al jugador que perdió (bug
// real reportado con captura: "franchicha won the match" cuando el texto decía
// "Ambience vs Franky Franchicha" delante de un marcador que empezaba con las games
// de Franchicha). `matchDetail.winner`/`.loser` sí son autoritativos — vienen de
// `matches.winnerId`, no del orden arbitrario de player1/player2 — así que el cruce se
// reconstruye a partir de ahí en vez de fiarse de matchLabel.
function winnerFirstMatchLabel(n: NominationDisplay): string {
  if (!n.matchLabel) return "Nominee";
  if (!n.matchDetail) return n.matchLabel;
  const tail = n.matchLabel.split(" — ").slice(1).join(" — ");
  return `${n.matchDetail.winner.displayName} vs ${n.matchDetail.loser.displayName} — ${tail}`;
}

// El nominado va en negrita. 'player_in_match' (Point/Upset of the Month(/Year)) es
// sobre UN punto o UN vuelco dentro de un partido, no sobre el partido entero como
// tal — pedido explícito: "just show the match (Winner vs Opponent) and not Winner --
// Winner vs Opponent", así que aquí se enseña solo el cruce, sin repetir el nombre del
// nominado aparte ni el evento/ronda. 'match' (Match of the Month/Year) sí es sobre el
// partido entero, ahí se mantiene el contexto completo, con el ganador primero (ver
// winnerFirstMatchLabel). 'player' (sin partido) es solo el nombre — el contexto de
// partido, cuando lo hay, se queda en texto normal, mismo criterio que winnerLine en
// announceAwardsVotingClosed.ts.
function nomineeLine(n: NominationDisplay, nomineeKind: AwardCategory["nomineeKind"]): string {
  const label =
    nomineeKind === "player_in_match" && n.playerName && n.matchLabel
      ? `**${orderedMatchup(n.playerName, n.matchLabel)}**`
      : nomineeKind === "match" && n.matchLabel
        ? `**${winnerFirstMatchLabel(n)}**`
        : n.playerName && n.matchLabel
          ? `**${n.playerName}** (${n.matchLabel})`
          : n.playerName
            ? `**${n.playerName}**`
            : n.matchLabel
              ? `**${n.matchLabel}**`
              : "Nominee";
  const score = n.scoreRaw ? ` — ${n.scoreRaw}` : "";
  const clip = n.clipUrl ? ` — [Watch clip](${n.clipUrl})` : "";
  return `• ${label}${score}${clip}`;
}

function pollAnswerLabel(n: NominationDisplay, nomineeKind: AwardCategory["nomineeKind"]): string {
  const label =
    nomineeKind === "player_in_match" && n.playerName && n.matchLabel
      ? orderedMatchup(n.playerName, n.matchLabel)
      : nomineeKind === "match" && n.matchLabel
        ? winnerFirstMatchLabel(n)
        : n.playerName && n.matchLabel
          ? `${n.playerName} — ${n.matchLabel}`
          : (n.playerName ?? n.matchLabel ?? "Nominee");
  return label.length > POLL_ANSWER_MAX_LENGTH ? `${label.slice(0, POLL_ANSWER_MAX_LENGTH - 1)}…` : label;
}

interface VotingPeriodRow extends AwardPeriodRow {
  announcedOpenAt: Date | null;
}

async function findVotingPeriods(): Promise<VotingPeriodRow[]> {
  return db
    .select({
      id: awardPeriods.id,
      cycle: awardPeriods.cycle,
      year: awardPeriods.year,
      month: awardPeriods.month,
      status: awardPeriods.status,
      speech: awardPeriods.speech,
      votingOpensAt: awardPeriods.votingOpensAt,
      votingClosesAt: awardPeriods.votingClosesAt,
      announcedOpenAt: awardPeriods.announcedOpenAt,
    })
    .from(awardPeriods)
    .where(eq(awardPeriods.status, "voting"));
}

async function postCategoryPoll(channel: TextChannel, period: AwardPeriodRow, category: AwardCategory, nominees: NominationDisplay[]): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xc4d82e)
    .setTitle(`${category.emoji} ${category.label} — ${periodLabel(period)}`)
    .setDescription(nominees.map((n) => nomineeLine(n, category.nomineeKind)).join("\n\n"));

  await channel.send({ embeds: [embed] });

  // Sondeo en su PROPIO mensaje, después del detalle — pedido explícito: en un único
  // mensaje con `embeds` + `poll` a la vez, Discord dibuja el sondeo ARRIBA del embed
  // (confirmado con una captura real), justo al revés del orden que tiene sentido aquí
  // (primero el detalle para decidir, el sondeo debajo para votar ya decidido).
  //
  // Máximo 10 respuestas por sondeo (límite real de Discord) — ninguna categoría se ha
  // acercado nunca a eso, pero se recorta en vez de fallar si algún día pasa.
  const poll: PollData = {
    question: { text: `${category.emoji} ${category.label} — ${periodLabel(period)}` },
    answers: nominees.slice(0, 10).map((n) => ({ text: pollAnswerLabel(n, category.nomineeKind) })),
    duration: POLL_DURATION_HOURS,
    allowMultiselect: false,
  };

  const pollMessage = await channel.send({ poll });

  await db
    .update(awardNominations)
    .set({ discordPollMessageId: pollMessage.id })
    .where(
      inArray(
        awardNominations.id,
        nominees.map((n) => n.id),
      ),
    );
}

async function announceOnePeriodOpened(period: VotingPeriodRow, channelId: string): Promise<void> {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const nominations = await getNominationsForPeriod(period.id, ["approved"]);
  const categories = categoriesForCycle(period.cycle as AwardCycle).filter((c) => nominations.some((n) => n.categoryKey === c.key));
  if (categories.length === 0) return;

  const isFirstOpen = period.announcedOpenAt === null;

  if (isFirstOpen) {
    // Contenido normal del mensaje, NO un embed — un embed nunca dispara una mención
    // de verdad (ni de rol ni @everyone), Discord solo procesa menciones en el texto
    // normal de un mensaje. Pedido explícito del propietario: "In the speech admins
    // can tag, either roles or everyone" (ver el desplegable de menciones en
    // components/admin/RichTextEditor.tsx). El bot necesita el permiso "Mention
    // @everyone, @here, and All Roles" en el canal para que un @everyone/rol del
    // discurso pingue de verdad, no solo se vea en azul.
    const base = siteBaseUrl();
    const speechText = period.speech ? htmlToDiscordMarkdown(toEditorContent(period.speech)) : null;
    const header = [`🏆 **${periodLabel(period)} — Voting is open!**`, speechText, base ? `Final results will be posted at ${base}/awards` : null]
      .filter(Boolean)
      .join("\n\n");

    for (const chunk of chunkForDiscordContent(header)) {
      await channel.send({ content: chunk });
    }
  }

  for (const category of categories) {
    const nominees = nominations.filter((n) => n.categoryKey === category.key);
    if (nominees.some((n) => n.discordPollMessageId !== null)) continue; // esta categoría ya tiene su sondeo publicado
    await postCategoryPoll(channel, period, category, nominees);
  }

  if (isFirstOpen) {
    await db.update(awardPeriods).set({ announcedOpenAt: new Date() }).where(eq(awardPeriods.id, period.id));
  }
}

export async function announceAwardsVotingOpened(): Promise<void> {
  const channelId = process.env.DISCORD_AWARDS_CHANNEL_ID;
  if (!channelId) return;

  const periods = await findVotingPeriods();
  for (const period of periods) {
    try {
      await announceOnePeriodOpened(period, channelId);
    } catch (err) {
      console.error(`✗ No se pudo anunciar la apertura de votación de ${periodLabel(period)}:`, err);
    }
  }
}
