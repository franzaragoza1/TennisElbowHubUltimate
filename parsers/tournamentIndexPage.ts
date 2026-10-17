/**
 * `OnlineTournaments.php` (sin `?Archive=`): los torneos de la temporada actual — en
 * inscripción y en juego. Solo interesan sus `Trn=`: los que todavía no existen en la base de
 * datos se cargan solos (descubrimiento automático, scripts/autoScrape.ts) en vez de esperar a
 * que alguien pegue el número en el panel de admin.
 */
export function parseTournamentIndexTrns(html: string): string[] {
  const seen = new Set<string>();
  for (const m of html.matchAll(/OT_ViewTournament\.php\?Trn=(\d+)/gi)) seen.add(m[1]);
  return [...seen];
}
