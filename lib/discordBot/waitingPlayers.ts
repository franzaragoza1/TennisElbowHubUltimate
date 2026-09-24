/**
 * Estado de "quién busca rival ahora mismo" — puro en memoria, a propósito (pedido
 * explícito del propietario, 2026-09-24: esto NUNCA debe tocar Neon, ni de lejos con
 * la frecuencia — cada 30-60s — que necesita sentirse "en vivo"). Tanto quien escribe
 * aquí (el listener de mensajes de `elbot`) como quien lee (la tarea periódica del
 * tablero) viven en el MISMO proceso de `scripts/discordBot.ts` — no hace falta nada
 * compartido entre procesos. Perder esta lista entera si el bot se reinicia es un
 * cambio aceptable a propósito: son anuncios que `elbot` repite solo mientras siguen
 * siendo ciertos, nunca algo que de verdad necesite sobrevivir un reinicio.
 */
import type { WaitingAnnouncement } from "./elbotMessages";
import { waitingEntryMatchesShortName } from "./elbotMessages";

export interface WaitingEntry extends WaitingAnnouncement {
  announcedAt: number; // Date.now(), no un objeto Date — comparación simple más abajo
}

/** Clave por `displayName` tal cual lo da elbot — un anuncio nuevo del mismo nombre
 * pisa al anterior sin más (mismo jugador, datos más frescos). */
const waiting = new Map<string, WaitingEntry>();

/** Nadie ha visto un anuncio de este jugador en más de esto sin que empezara una
 * partida real ni se repitiera — se considera abandonado y se olvida solo. `elbot`
 * repite el mismo anuncio cada pocos minutos mientras sigue en pie (visto en el
 * historial real), así que este margen es generoso a propósito, nunca tan corto que
 * borre un anuncio todavía válido entre una repetición y la siguiente. */
const STALE_AFTER_MS = 45 * 60 * 1000;

export function recordWaitingAnnouncement(announcement: WaitingAnnouncement): void {
  waiting.set(announcement.displayName, { ...announcement, announcedAt: Date.now() });
}

/** Quita de la lista a cualquier jugador cuyo nombre completo case con este nombre
 * abreviado (ver `waitingEntryMatchesShortName`) — llamado con los DOS nombres de un
 * mensaje "started a game", porque los dos jugadores dejan de estar "buscando rival"
 * a la vez. Silencioso si ninguno casaba (no todo el mundo que empieza una partida
 * había anunciado antes por aquí). */
export function clearWaitingByShortName(shortName: string): void {
  for (const [key, entry] of waiting) {
    if (waitingEntryMatchesShortName(entry.displayName, shortName)) waiting.delete(key);
  }
}

/** Devuelve la lista vigente, más reciente primero, quitando primero cualquier
 * entrada ya caducada — se llama una vez por pasada de la tarea del tablero, así que
 * no hace falta un temporizador aparte solo para limpiar. */
export function listCurrentWaitingPlayers(): WaitingEntry[] {
  const now = Date.now();
  for (const [key, entry] of waiting) {
    if (now - entry.announcedAt > STALE_AFTER_MS) waiting.delete(key);
  }
  return [...waiting.values()].sort((a, b) => b.announcedAt - a.announcedAt);
}
