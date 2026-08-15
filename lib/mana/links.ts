/**
 * Sin dependencias a propósito (nada de Playwright ni de Node) — a diferencia de
 * `lib/mana/fetchLive.ts`, este módulo lo importan componentes (`TournamentCard`),
 * así que tiene que poder acabar en el bundle del navegador sin arrastrar nada del
 * scraper detrás.
 */
export const MANA_FORUM_BASE_URL = "https://www.managames.com/Forum";

export function manaTournamentUrl(externalId: string): string {
  return `${MANA_FORUM_BASE_URL}/OT_ViewTournament.php?Trn=${externalId}`;
}
