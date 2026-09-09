/**
 * Anuncia los ganadores en cuanto un período de premios se cierra
 * (app/admin/awards/actions.ts::closeVoting) — mismo criterio de idempotencia
 * (`announcedClosedAt`) y de canal opcional que announceAwardsVotingOpened.ts, ver el
 * comentario de ese fichero.
 *
 * A diferencia del anuncio de apertura (nombres en negrita, sin pings — es solo una
 * lista de nominados), aquí SÍ se pinga al ganador cuando tiene Discord vinculado
 * (mentionOrBold, mismo criterio que announceResults.ts para un resultado real): un
 * ganador es un logro que merece notificar de verdad, una nominación no. Para
 * "Match of the Month/Year" (nomineeKind 'match', sin un único jugador protagonista)
 * se enseñan los dos nombres del partido en negrita, sin pings — no hay un solo
 * "ganador del premio" al que atribuírselo.
 */
import { ChannelType, EmbedBuilder } from "discord.js";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { awardPeriods } from "@/db/schema";
import { getAwardCategory } from "@/lib/awards/catalog";
import { periodLabel } from "@/lib/awards/format";
import { getPeriodResults, type AwardPeriodRow, type NominationDisplay } from "@/lib/awards/queries";
import { resolvePlayerLinks } from "@/lib/playerLinks";
import { mentionOrBold } from "../mentions";
import { discordClient } from "../client";

async function winnerLine(winner: NominationDisplay & { voteCount: number }): Promise<string> {
  const votes = `(${winner.voteCount} vote${winner.voteCount === 1 ? "" : "s"})`;
  const score = winner.scoreRaw ? ` — ${winner.scoreRaw}` : "";
  if (winner.playerId) {
    const links = await resolvePlayerLinks({ playerId: winner.playerId, linkedUserId: winner.playerLinkedUserId });
    const who = mentionOrBold(winner.playerName ?? "Someone", links.discordUserId);
    return winner.matchLabel ? `${who} — ${winner.matchLabel}${score} ${votes}` : `${who} ${votes}`;
  }
  return `**${winner.matchLabel ?? "Nobody nominated"}**${score} ${votes}`;
}

async function findPeriodsAwaitingClosedAnnouncement(): Promise<AwardPeriodRow[]> {
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
    })
    .from(awardPeriods)
    .where(and(eq(awardPeriods.status, "closed"), isNull(awardPeriods.announcedClosedAt)));
}

async function announceOnePeriodClosed(period: AwardPeriodRow, channelId: string): Promise<void> {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const results = await getPeriodResults(period.id);

  const fields = await Promise.all(
    results
      .filter((r) => r.winner !== null)
      .map(async (r) => ({
        name: `${getAwardCategory(r.categoryKey)?.emoji ?? ""} ${getAwardCategory(r.categoryKey)?.label ?? r.categoryKey}`.trim(),
        value: await winnerLine(r.winner!),
      })),
  );

  const embed = new EmbedBuilder().setColor(0xc4d82e).setTitle(`🏆 ${periodLabel(period)} — Winners!`).addFields(fields);

  await channel.send({ embeds: [embed] });

  await db.update(awardPeriods).set({ announcedClosedAt: new Date() }).where(eq(awardPeriods.id, period.id));
}

export async function announceAwardsVotingClosed(): Promise<void> {
  const channelId = process.env.DISCORD_AWARDS_CHANNEL_ID;
  if (!channelId) return;

  const periods = await findPeriodsAwaitingClosedAnnouncement();
  for (const period of periods) {
    try {
      await announceOnePeriodClosed(period, channelId);
    } catch (err) {
      console.error(`✗ No se pudo anunciar el cierre de votación de ${periodLabel(period)}:`, err);
    }
  }
}
