/**
 * Selección y clasificación de qué partidos necesitan la atención de un moderador —
 * pura, sin Discord.js ni base de datos (mismo criterio que liveBoardCards.ts), para
 * poder testear la lógica de verdad. Pedido explícito del propietario, 2026-09-27:
 * "Moderators need a better look for all matches that are almost or already past the
 * deadlines, also telling if that particular match hasn't been discussed (no messages
 * by opponents in the thread and no confirm button...)".
 */
import { formatDeadlineUtc } from "./deadlineText";

/** Cuánto antes del plazo un partido pasa a "casi vencido" — pedido tal cual ("almost
 * ... past the deadlines"), sin una cifra concreta; se elige 24h porque es la misma
 * frontera donde `sendReminders.ts::reminderIntervalMs` pasa de avisar una vez al día a
 * cada 6h — el punto en el que organizar el partido ya es urgente de verdad. */
export const NEAR_DEADLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface BoardEntry {
  /** `discordMatchupThreads.id` — el "Match ID" que ya usa /extend. */
  id: number;
  threadId: string;
  eventName: string;
  roundLabel: string;
  player1Name: string;
  player2Name: string;
  effectiveDeadlineMs: number;
  /** Un lado sin Discord vinculado nunca puede confirmar — "confirmado del todo"
   * cuenta solo lo que de verdad se puede confirmar, mismo criterio que
   * sendReminders.ts::processOne. Un partido así ya está organizado aunque el plazo
   * esté encima: no necesita ojo de moderador. */
  fullyConfirmed: boolean;
  /** null = nadie de los dos jugadores ha escrito todavía en el hilo. */
  lastActivityAt: number | null;
  player1ConfirmedAt: number | null;
  player2ConfirmedAt: number | null;
}

export interface ClassifiedEntry {
  entry: BoardEntry;
  overdue: boolean;
  /** Sin ningún rastro de organización: ni un mensaje de ninguno de los dos
   * jugadores, ni un confirm pulsado por ninguno de los dos — el único par de
   * señales que hoy se pueden rastrear de verdad (mensaje en el hilo, botón
   * Confirm). Si algún día hay otra interacción rastreable, entra aquí también. */
  undiscussed: boolean;
}

/** null = este partido no necesita salir en el tablero — le sobra tiempo, o ya está
 * confirmado por todo el que podía confirmar. */
export function classifyForBoard(entry: BoardEntry, nowMs: number): ClassifiedEntry | null {
  if (entry.fullyConfirmed) return null;
  const msUntil = entry.effectiveDeadlineMs - nowMs;
  if (msUntil > NEAR_DEADLINE_WINDOW_MS) return null;
  const undiscussed = entry.lastActivityAt === null && entry.player1ConfirmedAt === null && entry.player2ConfirmedAt === null;
  return { entry, overdue: msUntil < 0, undiscussed };
}

/** Más urgente primero: vencido y sin discutir, vencido, casi vencido y sin discutir,
 * casi vencido — dentro del mismo grupo, el plazo más próximo primero. */
export function sortForBoard(classified: ClassifiedEntry[]): ClassifiedEntry[] {
  const rank = (c: ClassifiedEntry) => (c.overdue ? 0 : 2) + (c.undiscussed ? 0 : 1);
  return [...classified].sort((a, b) => rank(a) - rank(b) || a.entry.effectiveDeadlineMs - b.entry.effectiveDeadlineMs);
}

/** Enlace directo al hilo de organización — un moderador tiene que poder saltar a él
 * en un clic, no solo enterarse de que existe. */
export function threadJumpUrl(guildId: string, threadId: string): string {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

/** Una tarjeta (campo de embed) por partido, para el tablero persistente. */
export function formatBoardCard(guildId: string, classified: ClassifiedEntry): { name: string; value: string } {
  const { entry, overdue, undiscussed } = classified;
  const statusEmoji = overdue ? "🔴" : "🟡";
  const name = `${statusEmoji} ${entry.eventName} · ${entry.roundLabel} — Match #${entry.id}`;
  const lines = [
    `**${entry.player1Name}** vs **${entry.player2Name}**`,
    `${overdue ? "Deadline passed" : "Deadline"}: ${formatDeadlineUtc(new Date(entry.effectiveDeadlineMs))}`,
    undiscussed ? "⚠️ No activity yet — no messages from either player, no confirmation." : "_Some activity already — see the thread._",
    `[Jump to thread](${threadJumpUrl(guildId, entry.threadId)})`,
  ];
  return { name, value: lines.join("\n") };
}
