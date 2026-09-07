/**
 * Recordatorios en el hilo de organización — cadencia adaptativa (menos avisos cuanto
 * más lejos está el plazo, más según se acerca, pedido explícito), un único aviso tras
 * vencer el plazo, y detección de que el partido ya se jugó (para dejar de recordar
 * algo que ya pasó). El plazo real se lee EN VIVO de `edition_round_deadlines` — nunca
 * se copia al crear el hilo, porque si Mana publica un plazo nuevo (un moderador lo
 * extiende EN SU PROPIO SITIO) el siguiente scrape ya lo actualiza solo (ver
 * db/schema.ts, comentario de `discordMatchupThreads`). La extensión que da un
 * moderador con `/extend` (`extensionDays`) se suma encima de ese plazo real.
 */
import { and, eq, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordMatchupThreads, editionRoundDeadlines, matches, players } from "@/db/schema";
import { discordClient } from "../client";
import { mentionOrBold } from "../mentions";
import { resolvePlayerLinks } from "@/lib/playerLinks";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** null = todavía demasiado pronto para el primer recordatorio. */
function reminderIntervalMs(msUntilDeadline: number): number | null {
  if (msUntilDeadline > 3 * DAY_MS) return null; // más de 3 días: nada todavía
  if (msUntilDeadline > DAY_MS) return DAY_MS; // 1-3 días: cada 24h
  if (msUntilDeadline > 6 * HOUR_MS) return 6 * HOUR_MS; // 6-24h: cada 6h
  return 2 * HOUR_MS; // menos de 6h: cada 2h
}

interface OpenThreadRow {
  id: number;
  editionId: number;
  round: string;
  threadId: string;
  player1Id: number;
  player1Name: string;
  player1LinkedUserId: string | null;
  player1ConfirmedAt: Date | null;
  player2Id: number;
  player2Name: string;
  player2LinkedUserId: string | null;
  player2ConfirmedAt: Date | null;
  extensionDays: number;
  lastReminderAt: Date | null;
  deadlineAt: Date | null;
}

async function findOpenThreads(): Promise<OpenThreadRow[]> {
  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  return db
    .select({
      id: discordMatchupThreads.id,
      editionId: discordMatchupThreads.editionId,
      round: discordMatchupThreads.round,
      threadId: discordMatchupThreads.threadId,
      player1Id: discordMatchupThreads.player1Id,
      player1Name: p1.displayName,
      player1LinkedUserId: p1.linkedUserId,
      player1ConfirmedAt: discordMatchupThreads.player1ConfirmedAt,
      player2Id: discordMatchupThreads.player2Id,
      player2Name: p2.displayName,
      player2LinkedUserId: p2.linkedUserId,
      player2ConfirmedAt: discordMatchupThreads.player2ConfirmedAt,
      extensionDays: discordMatchupThreads.extensionDays,
      lastReminderAt: discordMatchupThreads.lastReminderAt,
      deadlineAt: editionRoundDeadlines.deadlineAt,
    })
    .from(discordMatchupThreads)
    .innerJoin(p1, eq(p1.id, discordMatchupThreads.player1Id))
    .innerJoin(p2, eq(p2.id, discordMatchupThreads.player2Id))
    .leftJoin(
      editionRoundDeadlines,
      and(eq(editionRoundDeadlines.editionId, discordMatchupThreads.editionId), eq(editionRoundDeadlines.round, discordMatchupThreads.round)),
    )
    // Ya avisado del plazo vencido = terminado, nunca se vuelve a tocar (ni para más
    // recordatorios NI para comprobar si mientras tanto se jugó) — si de verdad se
    // llegó a jugar después, el hilo se queda ahí sin más, inactivo pero inofensivo.
    .where(isNull(discordMatchupThreads.overdueNotifiedAt));
}

async function hasBeenPlayed(row: OpenThreadRow): Promise<boolean> {
  // Comparación de la pareja SIN ORDENAR — no hay garantía de que el lado que era
  // "player1" en el hueco pendiente siga siendo "player1" en la fila de `matches` ya
  // decidida (docs/estructura.md / lib/nextOpponent.ts ya tuvieron este mismo problema).
  const [found] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.editionId, row.editionId),
        eq(matches.round, row.round),
        or(
          and(eq(matches.player1Id, row.player1Id), eq(matches.player2Id, row.player2Id)),
          and(eq(matches.player1Id, row.player2Id), eq(matches.player2Id, row.player1Id)),
        ),
      ),
    )
    .limit(1);
  return Boolean(found);
}

async function closeThread(row: OpenThreadRow, reason: string): Promise<void> {
  try {
    const thread = await discordClient.channels.fetch(row.threadId);
    if (thread?.isThread()) {
      await thread.send(reason);
      await thread.setLocked(true).catch(() => {});
      await thread.setArchived(true).catch(() => {});
    }
  } catch (err) {
    console.error(`✗ No se pudo cerrar el hilo ${row.threadId}:`, err);
  } finally {
    // El seguimiento de confirmación deja de tener sentido: el partido ya está
    // decidido (o el plazo venció y se avisó), no hay nada más que recordar aquí.
    await db.delete(discordMatchupThreads).where(eq(discordMatchupThreads.id, row.id));
  }
}

async function outstandingMentions(row: OpenThreadRow): Promise<string[]> {
  const mentions: string[] = [];
  if (row.player1LinkedUserId && !row.player1ConfirmedAt) {
    const links = await resolvePlayerLinks({ playerId: row.player1Id, linkedUserId: row.player1LinkedUserId });
    mentions.push(mentionOrBold(row.player1Name, links.discordUserId));
  }
  if (row.player2LinkedUserId && !row.player2ConfirmedAt) {
    const links = await resolvePlayerLinks({ playerId: row.player2Id, linkedUserId: row.player2LinkedUserId });
    mentions.push(mentionOrBold(row.player2Name, links.discordUserId));
  }
  return mentions;
}

async function processOne(row: OpenThreadRow): Promise<void> {
  const linked1 = row.player1LinkedUserId !== null;
  const linked2 = row.player2LinkedUserId !== null;
  const confirmed1 = !linked1 || row.player1ConfirmedAt !== null;
  const confirmed2 = !linked2 || row.player2ConfirmedAt !== null;
  // "Thread is still opened but only needs confirmation by one user" (pedido
  // explícito) — cuando un lado no tiene Discord vinculado, nunca podrá pulsar nada,
  // así que "todo confirmado" solo exige lo que de verdad se puede confirmar.
  if (confirmed1 && confirmed2) return;

  if (await hasBeenPlayed(row)) {
    await closeThread(row, "This match has already been played — closing the organizing thread.");
    return;
  }

  if (!row.deadlineAt) return; // Mana todavía no publica el plazo de esta ronda

  const effectiveDeadline = row.deadlineAt.getTime() + row.extensionDays * DAY_MS;
  const msUntil = effectiveDeadline - Date.now();
  const thread = await discordClient.channels.fetch(row.threadId);
  if (!thread?.isThread()) return;

  if (msUntil < 0) {
    const mentions = await outstandingMentions(row);
    await thread.send(`⏰ The deadline for this match has passed. ${mentions.join(" ")} — please sort this out or reach out to a moderator.`);
    await db.update(discordMatchupThreads).set({ overdueNotifiedAt: new Date() }).where(eq(discordMatchupThreads.id, row.id));
    return;
  }

  const interval = reminderIntervalMs(msUntil);
  if (interval === null) return;
  if (row.lastReminderAt && Date.now() - row.lastReminderAt.getTime() < interval) return;

  const mentions = await outstandingMentions(row);
  if (mentions.length === 0) return; // nadie vinculado a quien recordarle nada
  // `<t:...:R>` en vez de calcular "in X hours" a mano — Discord lo renderiza en vivo
  // y localizado ("in 5 hours", "in 2 days"...), mismo formato que ya usa el
  // encabezado del hilo en announceMatchups.ts para la fecha absoluta del plazo.
  const relativeDeadline = `<t:${Math.floor(effectiveDeadline / 1000)}:R>`;
  await thread.send(`Reminder: please organize this match before the deadline (${relativeDeadline}). ${mentions.join(" ")}`);
  await db.update(discordMatchupThreads).set({ lastReminderAt: new Date() }).where(eq(discordMatchupThreads.id, row.id));
}

export async function sendReminders(): Promise<void> {
  const rows = await findOpenThreads();
  for (const row of rows) {
    try {
      await processOne(row);
    } catch (err) {
      console.error(`✗ Fallo procesando recordatorios del hilo #${row.id}:`, err);
    }
  }
}
