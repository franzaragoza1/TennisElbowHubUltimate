import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";
import { LastResultsPageSchema, type ParsedLastResultsPage, type ParsedRecentResult, type PlayerRef } from "./schemas";
import { parseScoreText } from "./tournamentPage";

function extractPlayerLink($: CheerioAPI, td: Cheerio<Element>): PlayerRef | null {
  const a = td.find('a[href*="memberlist.php"]').first();
  if (a.length === 0) return null;
  const href = a.attr("href") ?? "";
  const externalId = new URL(href, "https://example.invalid/").searchParams.get("u");
  if (!externalId) return null;
  return { externalId, displayName: a.text().trim() };
}

/**
 * HTML de `OT_LastResults.php` -> lista de resultados recientes, más recientes
 * primero (así viene ya la fuente). A diferencia del cuadro de un torneo, aquí SÍ hay
 * fecha y hora real de cuándo se reportó el resultado, y quién lo reportó — los dos
 * únicos sitios de la fuente donde existe ese dato (docs/estructura.md §4).
 *
 * Igual que en el índice anual de torneos, la celda de fecha (`Day`) solo aparece en
 * la primera fila de ese día — las siguientes traen `<td class="Hidden">` en su lugar
 * y hay que "arrastrar" el día hacia abajo.
 *
 * El enlace al torneo ya trae el `Trn=` directamente (`OT_ViewTournament.php?Trn=X`)
 * — no hace falta casar por nombre para saber a qué edición pertenece cada fila.
 */
export function parseLastResultsPage(html: string): ParsedLastResultsPage {
  const $ = cheerio.load(html);
  const table = $("dl.Ot dd.dd2 table.Ot").first();
  const results: ParsedRecentResult[] = [];

  let currentDay: string | null = null;
  table.find("tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 9) return; // fila inesperada (cabecera repetida, separador...): se descarta sin abortar el pase

    const dayCell = $(tds[0]);
    if (dayCell.hasClass("Title")) {
      const dayText = dayCell.text().trim();
      if (dayText) currentDay = dayText;
    }
    if (!currentDay) return; // nunca debería pasar (la primera fila siempre trae Title), red de seguridad

    const time = $(tds[1]).text().trim();
    const tournamentLink = $(tds[2]).find("a").first();
    const tournamentExternalId = new URL(tournamentLink.attr("href") ?? "", "https://example.invalid/").searchParams.get(
      "Trn",
    );
    const tournamentName = tournamentLink.text().trim();
    const competition = $(tds[3]).text().trim();
    const round = $(tds[4]).text().trim();
    const winner = extractPlayerLink($, $(tds[5]));
    const loser = extractPlayerLink($, $(tds[6]));
    const scoreRaw = $(tds[7]).text().trim();
    const reporter = extractPlayerLink($, $(tds[8]));

    if (!tournamentExternalId || !tournamentName || !winner || !loser || !scoreRaw) return;

    const { outcome, sets } = parseScoreText(scoreRaw);

    results.push({
      reportedAt: `${currentDay}T${time || "00:00:00"}`,
      tournamentExternalId,
      tournamentName,
      competition,
      round,
      winner,
      loser,
      scoreRaw,
      outcome,
      sets,
      reporter,
    });
  });

  return LastResultsPageSchema.parse({ results });
}
