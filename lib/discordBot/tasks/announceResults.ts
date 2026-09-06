/**
 * Anuncia un resultado en cuanto `matches` tiene una fila jugada — pedido explícito:
 * publica el resultado y ofrece la entrevista post-partido a cada jugador, solo con
 * botón para el lado que tiene Discord vinculado (sin cuenta vinculada no hay dónde
 * abrir el hilo de la entrevista).
 *
 * Clave de dedup: `(editionId, round, player1Id, player2Id)` — mismo motivo que
 * `announceMatchups.ts`: `matches` se borra y se reinserta entera en cada recarga del
 * torneo, así que `matches.id` no es una identidad estable para "¿ya lo publiqué?".
 *
 * A diferencia de `pending_slots` (que solo contiene huecos TODAVÍA sin decidir, así
 * que nunca acumula historial), `matches` guarda TODO el archivo desde 2021 — sin una
 * ventana de recencia, la primera vez que arranca el bot intentaría anunciar miles de
 * partidos históricos de golpe. Se limita a resultados de los últimos
 * `RECENT_WINDOW_DAYS` días, mismo criterio de "reciente" (`played_at` si existe, si
 * no la semana del torneo) que ya usa `lib/newsGeneration/facts.ts::RECENCY_SQL`.
 *
 * Bug real encontrado en producción: para un partido espejado de Finals
 * (`lib/finals/mirror.ts`), `matches.played_at` es EXACTAMENTE el momento en que un
 * admin registra el resultado en `/admin/finals` (`app/admin/finals/actions.ts`,
 * `playedAt: new Date()`), no cuándo se jugó de verdad. Eso es correcto para unas
 * Finals en curso ahora mismo, pero al cargar unas Finals de una temporada pasada
 * (backfill histórico), `played_at` sale "hoy" igual que si fuera de verdad reciente —
 * unas ATP Finals de hace años se anunciaban como si acabaran de jugarse. Para un
 * partido espejado se usa en su lugar el año de la propia `finals_editions` (dato real
 * introducido a mano al crear esa edición, nunca autogenerado) — solo se considera
 * reciente si ese año es el actual. Los partidos normales del tour siguen exactamente
 * igual que antes.
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";
import { and, eq, isNotNull, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordMatchResultPosts, editions, events, finalsEditions, finalsMatches, matches, players } from "@/db/schema";
import { resolvePlayerLinks } from "@/lib/playerLinks";
import { fullRoundLadder, roundDisplayLabel } from "@/lib/bracket";
import { discordClient } from "../client";
import { discordBotConfig } from "../config";

const RECENT_WINDOW_DAYS = 3;

interface FinishedMatchRow {
  editionId: number;
  round: string;
  drawSize: number;
  eventName: string;
  year: number;
  scoreRaw: string | null;
  outcome: string;
  player1Id: number;
  player1Name: string;
  player1LinkedUserId: string | null;
  player2Id: number;
  player2Name: string;
  player2LinkedUserId: string | null;
  winnerId: number | null;
}

async function findUnannouncedResults(): Promise<FinishedMatchRow[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");
  const sinceDate = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const currentYear = new Date().getFullYear();

  return db
    .select({
      editionId: matches.editionId,
      round: matches.round,
      drawSize: editions.drawSize,
      eventName: events.displayName,
      year: editions.year,
      scoreRaw: matches.scoreRaw,
      outcome: matches.outcome,
      player1Id: p1.id,
      player1Name: p1.displayName,
      player1LinkedUserId: p1.linkedUserId,
      player2Id: p2.id,
      player2Name: p2.displayName,
      player2LinkedUserId: p2.linkedUserId,
      winnerId: matches.winnerId,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(events, eq(events.id, editions.eventId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .leftJoin(finalsMatches, eq(finalsMatches.mirroredMatchId, matches.id))
    .leftJoin(finalsEditions, eq(finalsEditions.id, finalsMatches.finalsEditionId))
    .where(
      and(
        isNotNull(matches.winnerId),
        sql`(
          (${finalsEditions.year} IS NOT NULL AND ${finalsEditions.year} >= ${currentYear})
          OR (
            ${finalsEditions.year} IS NULL
            AND ((${matches.playedAt} IS NOT NULL AND ${matches.playedAt} >= ${sinceDate})
              OR (${matches.playedAt} IS NULL AND ${editions.weekStartDate} IS NOT NULL AND ${editions.weekStartDate} >= ${sinceDate}))
          )
        )`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(discordMatchResultPosts)
            .where(
              and(
                eq(discordMatchResultPosts.editionId, matches.editionId),
                eq(discordMatchResultPosts.round, matches.round),
                eq(discordMatchResultPosts.player1Id, matches.player1Id),
                eq(discordMatchResultPosts.player2Id, matches.player2Id),
              ),
            ),
        ),
      ),
    );
}

async function announceOneResult(row: FinishedMatchRow): Promise<void> {
  const channel = await discordClient.channels.fetch(discordBotConfig.resultsChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const [links1, links2] = await Promise.all([
    resolvePlayerLinks({ playerId: row.player1Id, linkedUserId: row.player1LinkedUserId }),
    resolvePlayerLinks({ playerId: row.player2Id, linkedUserId: row.player2LinkedUserId }),
  ]);

  const roundLabel = roundDisplayLabel(fullRoundLadder(row.drawSize), row.round);
  const winnerName = row.winnerId === row.player1Id ? row.player1Name : row.player2Name;
  const loserName = row.winnerId === row.player1Id ? row.player2Name : row.player1Name;
  const headline = `${row.eventName} ${row.year} ${roundLabel}: **${winnerName}** d. ${loserName} ${row.scoreRaw ?? `(${row.outcome})`}`;

  const embed = new EmbedBuilder().setColor(0x0057b8).setTitle(headline).setDescription("Want to give your take on this one? Press the button below to start a short interview.");

  // Igual que en announceMatchups.ts: el mensaje se publica ANTES de guardar el
  // seguimiento — si el insert fallara después de publicar, el próximo ciclo
  // simplemente lo reintenta (nunca al revés, o quedaría "ya publicado" sin mensaje).
  const message = await channel.send({ embeds: [embed] });

  const interviewRow = new ActionRowBuilder<ButtonBuilder>();
  if (links1.discordUserId) {
    interviewRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`interview:${row.editionId}:${row.round}:${row.player1Id}:${row.player2Id}`)
        .setLabel(`Interview me — ${row.player1Name}`)
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (links2.discordUserId) {
    interviewRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`interview:${row.editionId}:${row.round}:${row.player2Id}:${row.player1Id}`)
        .setLabel(`Interview me — ${row.player2Name}`)
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (interviewRow.components.length > 0) {
    await message.edit({ embeds: [embed], components: [interviewRow] });
  }

  await db.insert(discordMatchResultPosts).values({
    editionId: row.editionId,
    round: row.round,
    player1Id: row.player1Id,
    player2Id: row.player2Id,
    messageId: message.id,
    channelId: channel.id,
  });
}

export async function announceResults(): Promise<void> {
  const rows = await findUnannouncedResults();
  for (const row of rows) {
    try {
      await announceOneResult(row);
    } catch (err) {
      console.error(`✗ No se pudo anunciar el resultado ${row.eventName} ${row.round} (${row.player1Name} vs ${row.player2Name}):`, err);
    }
  }
}
