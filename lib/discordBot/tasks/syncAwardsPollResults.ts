/**
 * Lee el recuento final del sondeo real de Discord de un período en votación
 * (lib/discordBot/tasks/announceAwardsVotingOpened.ts publicó uno por categoría) y, en
 * cuanto TODAS las categorías del período tienen ya resultado finalizado
 * (`is_finalized` — Discord tarda un rato en confirmarlo tras la expiración real,
 * tanto si expiró sola por su duración como si el admin la cerró antes a mano), vuelca
 * cada recuento en `manualVoteCount` y cierra el período — deja que
 * announceAwardsVotingClosed.ts, sin cambios, anuncie los ganadores en su siguiente
 * pasada. Pedido explícito del propietario: "the poll must be on discord, then the
 * bot reads results when it gets closed and posts on the website".
 *
 * REST puro (`GET .../messages/{id}`), sin `discordClient` de gateway — leer un
 * mensaje no necesita una conexión de gateway activa, así que `syncOnePeriodPollResults`
 * se puede llamar tanto desde aquí (el ciclo periódico del bot, para el sondeo que
 * expira SOLO) como directo desde app/admin/awards/actions.ts::closeVoting (dentro del
 * propio proceso de Next, justo después de terminarlo a mano) — pedido explícito:
 * "can't it just do it once just after voting ends?". Para un cierre manual sí puede:
 * es un momento que controlamos nosotros. Para uno que expira solo no hay ningún
 * evento al que engancharse, así que ESE caso sigue necesitando el sondeo periódico
 * (scripts/discordBot.ts::runAwardsPollCycle, cada minuto).
 *
 * Emparejamiento respuesta <-> nominado: por POSICIÓN, no por texto (las respuestas
 * del sondeo van truncadas a 55 caracteres, ver pollAnswerLabel). El orden en el que
 * announceAwardsVotingOpened.ts construyó las respuestas es el mismo con el que
 * getNominationsForPeriod devuelve los nominados de esa categoría (createdAt
 * ascendente) — orden estable porque los nominados de un período ya en 'voting' no
 * cambian (addAdminNomination/removeNomination solo actúan sobre un período 'draft').
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { awardNominations, awardPeriods } from "@/db/schema";

interface PolledNomination {
  id: number;
  discordPollMessageId: string | null;
}

interface RawPollResults {
  answer_counts: { id: number; count: number }[];
  is_finalized: boolean;
}

async function fetchPollResults(channelId: string, messageId: string): Promise<RawPollResults | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return null;

  const message: { poll?: { results?: RawPollResults } } = await res.json();
  return message.poll?.results ?? null;
}

async function findVotingPeriods(): Promise<number[]> {
  const rows = await db.select({ id: awardPeriods.id }).from(awardPeriods).where(eq(awardPeriods.status, "voting"));
  return rows.map((r) => r.id);
}

/** true si el período se cerró de verdad esta vez (todas sus categorías ya tenían
 * resultado finalizado) — false si se quedó a medias (alguna todavía no) o si este
 * período ni siquiera tiene sondeos publicados todavía. */
export async function syncOnePeriodPollResults(periodId: number): Promise<boolean> {
  const channelId = process.env.DISCORD_AWARDS_CHANNEL_ID;
  if (!channelId) return false;

  const nominations: PolledNomination[] = await db
    .select({ id: awardNominations.id, discordPollMessageId: awardNominations.discordPollMessageId })
    .from(awardNominations)
    .where(and(eq(awardNominations.periodId, periodId), eq(awardNominations.status, "approved"), isNotNull(awardNominations.discordPollMessageId)))
    .orderBy(awardNominations.createdAt);

  if (nominations.length === 0) return false; // el bot todavía no ha publicado los sondeos de este período

  const messageIds = [...new Set(nominations.map((n) => n.discordPollMessageId as string))];

  const countsByMessage = new Map<string, number[]>();
  for (const messageId of messageIds) {
    const results = await fetchPollResults(channelId, messageId);
    if (!results || !results.is_finalized) return false; // cualquier categoría sin terminar todavía => se reintenta el período entero más tarde
    const sorted = [...results.answer_counts].sort((a, b) => a.id - b.id);
    countsByMessage.set(
      messageId,
      sorted.map((a) => a.count),
    );
  }

  const byMessage = new Map<string, PolledNomination[]>();
  for (const n of nominations) {
    const key = n.discordPollMessageId!;
    if (!byMessage.has(key)) byMessage.set(key, []);
    byMessage.get(key)!.push(n);
  }

  for (const [messageId, group] of byMessage) {
    const counts = countsByMessage.get(messageId)!;
    for (let i = 0; i < group.length; i++) {
      await db.update(awardNominations).set({ manualVoteCount: counts[i] ?? 0 }).where(eq(awardNominations.id, group[i].id));
    }
  }

  await db.update(awardPeriods).set({ status: "closed", votingClosesAt: new Date() }).where(eq(awardPeriods.id, periodId));
  return true;
}

export async function syncAwardsPollResults(): Promise<void> {
  const channelId = process.env.DISCORD_AWARDS_CHANNEL_ID;
  if (!channelId) return;

  const periodIds = await findVotingPeriods();
  for (const periodId of periodIds) {
    try {
      await syncOnePeriodPollResults(periodId);
    } catch (err) {
      console.error(`✗ No se pudo sincronizar el sondeo de Discord del período ${periodId}:`, err);
    }
  }
}
