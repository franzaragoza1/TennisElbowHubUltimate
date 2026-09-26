/**
 * Plazo de un partido en una hora COMÚN (UTC) — pedido de la comunidad (2026-09-26): el
 * `<t:...:F>` de Discord se pinta en la zona horaria de CADA lector, así que dos jugadores
 * que organizan el partido veían horas distintas y tenían que traducir. La disponibilidad
 * que cada jugador escribe en su ficha va en UTC±N, y así el plazo se compara directamente
 * con ella. Se añade el tiempo relativo (`<t:...:R>`, "in 5 days"), que no depende de la
 * zona horaria de nadie. Pura, sin Discord.js ni base de datos.
 */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDeadlineUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = `${DAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
  return `${text} (<t:${Math.floor(date.getTime() / 1000)}:R>)`;
}
