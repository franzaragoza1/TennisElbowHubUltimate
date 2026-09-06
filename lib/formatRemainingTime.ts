/** "Tiempo restante para jugar" de un plazo — pura, para poder testear sin reloj real
 * ni componente. Nunca redondea a "0" cuando en realidad ya pasó: un plazo vencido se
 * marca como tal explícitamente ("Overdue by ..."), nunca como "0h left". */
export function formatRemainingTime(deadlineAt: Date, now: Date = new Date()): string {
  const diffMs = deadlineAt.getTime() - now.getTime();
  const overdue = diffMs < 0;
  const totalMinutes = Math.floor(Math.abs(diffMs) / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  const duration = parts.join(" ");
  return overdue ? `Overdue by ${duration}` : `${duration} remaining`;
}
