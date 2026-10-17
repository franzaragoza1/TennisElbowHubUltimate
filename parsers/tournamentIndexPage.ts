import * as cheerio from "cheerio";

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

export interface CalendarEntry {
  isoWeek: number;
  eventName: string;
  competition: string | null;
  drawSize: number | null;
  surface: string | null;
  category: string | null;
}

/**
 * El bloque "Calendar" del mismo índice: torneos ya anunciados que todavía no tienen ficha
 * (`Trn=`) — p. ej. Paris Masters 1000 en la semana 45, visto 2026-10-17. Mismo formato de
 * fila que los otros bloques (la celda "Week N:" solo en la primera fila de cada semana, hay
 * que arrastrarla). Una fila con enlace a ficha no es del calendario y se ignora.
 */
export function parseTournamentIndexCalendar(html: string): CalendarEntry[] {
  const $ = cheerio.load(html);
  const out: CalendarEntry[] = [];
  let inCalendar = false;
  let week = 0;
  $("table.Ot tbody tr").each((_, tr) => {
    const row = $(tr);
    const block = row.find("td.Title[colspan]");
    if (block.length > 0) {
      inCalendar = /^\s*Calendar\s*$/i.test(block.text());
      return;
    }
    if (!inCalendar) return;
    const weekMatch = /Week\s+(\d+)/i.exec(row.find("td.Title").not("[colspan]").text());
    if (weekMatch) week = Number(weekMatch[1]);
    if (row.find('a[href*="OT_ViewTournament"]').length > 0) return;
    const cells = row
      .children("td")
      .not(".Hidden")
      .not(".Title")
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const [name, competition, draw, surface, category] = cells;
    if (!name || !week) return;
    const drawSize = Number(draw);
    out.push({
      isoWeek: week,
      eventName: name,
      competition: competition || null,
      drawSize: Number.isFinite(drawSize) && drawSize > 0 ? drawSize : null,
      surface: surface || null,
      category: category || null,
    });
  });
  return out;
}
