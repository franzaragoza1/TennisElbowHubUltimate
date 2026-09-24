/**
 * Parsea los mensajes que `elbot` (bot ajeno, ya en el mismo servidor de Discord —
 * pedido explícito del propietario, 2026-09-24) publica cada vez que alguien busca
 * partida o empieza una — la única fuente real de "esperando rival" que existe, ver
 * docs/decisiones.md: live-tennis.cn (nuestra fuente ya integrada) solo enseña
 * partidos ya en marcha, nunca lobbies sin rival. Función pura, sin red ni Discord.js
 * — mismo criterio que lib/liveTennis/parseLivePage.ts.
 *
 * Basado en mensajes reales capturados del canal (ver el propio historial de
 * `elbot`), no en documentación — dos formatos reales confirmados, cualquier otra
 * cosa (las líneas de resultado final, con frase variable tipo "X struggled
 * valiantly and wore down Y" / "X won against Y", o mensajes sueltos y rotos como un
 * simple "Comment: XKT v4.4b" sin el resto) se ignora sin más, nunca se intenta
 * adivinar.
 */

export interface WaitingAnnouncement {
  type: "waiting";
  displayName: string;
  elo: number;
  rep: number;
  sets: number;
  preview: string;
  difficulty: string;
  mode: string;
  comment: string;
}

export interface GameStarted {
  type: "started";
  /** Nombre ABREVIADO tal cual lo da elbot en esta línea — nunca el nombre completo
   * de la línea "wants to play" correspondiente (ver `waitingEntryMatchesShortName`
   * para cómo se casan las dos). */
  player1Short: string;
  player2Short: string;
}

export type ElbotEvent = WaitingAnnouncement | GameStarted;

// "**Rean Coldsteel** (elo: `1713`, rep: `24%`) wants to play a `1-set` match (using
// `Service + Rally` / `Simulation` / `Realistic`) Comment: XKT v4.4b"
const WAITING_PATTERN =
  /^\*\*(.+?)\*\* \(elo: `(-?\d+)`, rep: `(-?\d+)%`\) wants to play a `(\d+)-set` match \(using `([^`]*)` \/ `([^`]*)` \/ `([^`]*)`\) Comment: (.*)$/;

// "`            `_R.Coldsteel started a game with ComeDippers._" — el bloque de
// espacios entre backticks es un espaciador visual propio de elbot, no algo con
// significado; puede o no estar presente.
const STARTED_PATTERN = /^(?:`[^`]*`)?_(.+?) started a game with (.+?)\._$/;

/** `null` si el mensaje no encaja con ninguno de los dos formatos reales conocidos —
 * nunca lanza, nunca adivina un tercer formato. */
export function parseElbotMessage(content: string): ElbotEvent | null {
  const waiting = WAITING_PATTERN.exec(content);
  if (waiting) {
    const [, displayName, elo, rep, sets, preview, difficulty, mode, comment] = waiting;
    return {
      type: "waiting",
      displayName,
      elo: Number(elo),
      rep: Number(rep),
      sets: Number(sets),
      preview,
      difficulty,
      mode,
      comment,
    };
  }

  const started = STARTED_PATTERN.exec(content);
  if (started) {
    const [, player1Short, player2Short] = started;
    return { type: "started", player1Short, player2Short };
  }

  return null;
}

/**
 * ¿Es `shortName` (de un mensaje "started a game") la misma persona que anunció
 * `fullName` (de un mensaje "wants to play")? elbot abrevia el nombre completo para
 * esta línea — visto en mensajes reales: "Rean Coldsteel" -> "R.Coldsteel",
 * "[Fake] Holger Rune" -> "[.Rune", un nombre de una sola palabra ("Giuseppe",
 * "jele") se queda igual. La regla que encaja con TODOS los ejemplos reales vistos:
 * el nombre corto siempre TERMINA con la última palabra del nombre completo,
 * insensible a mayúsculas — nunca se intenta reconstruir la abreviatura exacta hacia
 * delante (un contraejemplo real, "Federer.R.", no encajaba con ningún patrón de
 * prefijo conocido, así que solo se confía en esta comprobación por el final).
 */
export function waitingEntryMatchesShortName(fullName: string, shortName: string): boolean {
  const lastWord = fullName.trim().split(/\s+/).pop();
  if (!lastWord) return false;
  return shortName.toLowerCase().endsWith(lastWord.toLowerCase());
}
