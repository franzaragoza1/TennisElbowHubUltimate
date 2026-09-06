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

/** `p=<externalId>` es el mismo espacio de IDs que `memberlist.php?...u=<id>`
 * (confirmado en docs/estructura.md §3) — un solo `player_aliases.external_id` de la
 * fuente 'mana' basta para construir el enlace al perfil real del jugador en el foro. */
export function manaPlayerUrl(externalId: string): string {
  return `${MANA_FORUM_BASE_URL}/OT_Player.php?p=${externalId}&d=0`;
}
