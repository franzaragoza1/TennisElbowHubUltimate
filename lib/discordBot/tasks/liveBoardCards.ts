/**
 * Formato de cada "tarjeta" del tablero — función pura, sin red ni Discord.js ni base
 * de datos, a propósito (mismo criterio que lib/liveTennis/parseLivePage.ts): vive
 * aparte de liveBoard.ts porque ESE fichero importa `@/db/client` a nivel de módulo,
 * y eso rompe la resolución del alias `@/` dentro de vitest en cuanto se intenta
 * testear cualquier cosa que lo importe, aunque sea indirectamente. Separar lo puro de
 * lo que toca Discord/la base de datos es lo que permite testear esto sin arrastrar
 * nada de eso.
 */
import type { RawLiveMatch } from "@/lib/liveTennis/parseLivePage";
import type { WaitingEntry } from "../waitingPlayers";
import type { GameFinished } from "../elbotMessages";

/** Ancho fijo de columna en los bloques de código de más abajo — recortado con "…" en
 * vez de desalinear el resto de la tarjeta si un nombre es más largo de la cuenta. */
export function padName(name: string, width: number): string {
  return name.length > width ? `${name.slice(0, width - 1)}…` : name.padEnd(width);
}

/**
 * Una tarjeta por partido, con las dos filas alineadas en un bloque de código
 * (monoespaciado real, a diferencia del resto del embed) — el mismo espíritu que la
 * tarjeta de partido del sitio (components/tournament/MatchCard.tsx): nombre, elo,
 * marcador por set en columnas, punto en curso de CADA jugador (nunca uno compartido,
 * son valores propios de la fuente) y un `●` marcando quién saca.
 */
export function formatLiveMatchCard(match: RawLiveMatch): { name: string; value: string } {
  const NAME_WIDTH = 20;
  const ELO_WIDTH = 7;
  const row = (player: RawLiveMatch["player1"]): string => {
    const serveMark = player.serving ? "●" : " ";
    const name = padName(player.name, NAME_WIDTH);
    const elo = padName(player.elo === null ? "unrated" : String(player.elo), ELO_WIDTH);
    const sets = player.setGames.map((g) => g.padStart(2)).join(" ");
    const point = (player.currentPoint || "").padStart(3);
    return `${serveMark} ${name} ${elo} ${sets}  ${point}`;
  };
  const value = ["```", row(match.player1), row(match.player2), "```"].join("\n");
  return { name: `🔴 ${match.courtTitle}`, value };
}

/** Una tarjeta por anuncio de "busca rival" — más simple que la de un partido (no hay
 * marcador que enseñar todavía), pero mismo criterio de bloque de código para que se
 * lea como su propia ficha, no una línea suelta entre otras. */
export function formatWaitingCard(entry: WaitingEntry): { name: string; value: string } {
  const lines = ["```", `elo ${entry.elo}   rep ${entry.rep}%`, `${entry.sets}-set · ${entry.difficulty} · ${entry.mode}`, "```"];
  return { name: `⏳ ${entry.displayName}`, value: lines.join("\n") };
}

/** Mensaje de aviso de un partido recién terminado — se publica como mensaje NUEVO y
 * suelto en el canal del tablero (nunca como parte del embed editado), pedido
 * explícito del propietario, 2026-09-27: "add the finished matches of the day, elbot
 * posts the results messages". Nombres tal cual los da elbot (abreviados, sin
 * resolver al completo — ver el comentario de cabecera de elbotMessages.ts). */
export function formatFinishedMatchAnnouncement(event: GameFinished): string {
  return `✅ **${event.winnerShort}** def. **${event.loserShort}** — \`${event.score}\``;
}

/** Campo "de relleno" con un espacio de ancho cero (no vacío del todo — Discord no
 * acepta un campo con nombre/valor realmente vacíos) — separa visualmente el bloque
 * de "en vivo" del de "esperando rival" en el embed. */
export function spacerField(): { name: string; value: string } {
  return { name: "​", value: "​" };
}
