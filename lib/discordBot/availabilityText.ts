/**
 * Bloque "Availability" del primer mensaje del hilo de un partido — pedido de la
 * comunidad (2026-09-26): que el hilo enseñe directamente la zona horaria y la
 * disponibilidad habitual de cada jugador, que ya escribieron en su ficha de Mana Games.
 * Pura, sin Discord.js ni base de datos, para poder probarla.
 *
 * El texto es libre y lo escribe el jugador: se colapsa a una línea, se recorta y se
 * neutralizan las menciones (`@everyone`, `@here`, `<@id>`) — este mensaje es del bot,
 * y un mention suyo notificaría de verdad.
 */
const MAX_LENGTH = 200;

export function cleanAvailability(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  const noMentions = oneLine.replace(/@/g, "@\u200b").replace(/<(@|#)/g, "<\u200b$1");
  return noMentions.length > MAX_LENGTH ? `${noMentions.slice(0, MAX_LENGTH - 1)}…` : noMentions;
}

export function availabilityBlock(entries: { name: string; availability: string | null }[]): string | null {
  const lines = entries
    .filter((e): e is { name: string; availability: string } => !!e.availability && e.availability.trim() !== "")
    .map((e) => `• **${e.name}**: ${cleanAvailability(e.availability)}`);
  if (lines.length === 0) return null;
  return `**Availability** (from their Mana Games profiles):\n${lines.join("\n")}`;
}
