import * as cheerio from "cheerio";
import {
  RankingPageSchema,
  type ParsedRankingPage,
  type ParsedRankingRow,
} from "./schemas";

/** HTML de OT_Rankings.php?Week=... -> ranking de esa semana. */
export function parseRankingPage(html: string): ParsedRankingPage {
  const $ = cheerio.load(html);

  const h2 = $("h2").first().text();
  const weekMatch = h2.match(/Rankings:\s*(\d{4})\s*Week\s*(\d+)/i);
  if (!weekMatch) {
    throw new Error(`No se pudo leer año/semana del título: "${h2}"`);
  }
  const isoYear = Number(weekMatch[1]);
  const isoWeek = Number(weekMatch[2]);

  const rows: ParsedRankingRow[] = [];
  $("table.Ot")
    .filter((_, table) => $(table).find("thead th").first().text().trim() === "Rank")
    .first()
    .find("tbody tr")
    .each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length < 6) return;

      const rank = Number($(cells[0]).text().trim());
      const movedText = $(cells[1]).text().trim();
      const moved = movedText === "--" ? 0 : Number(movedText.replace("+", ""));

      const link = $(cells[2]).find("a").first();
      const externalId = new URL(
        link.attr("href") ?? "",
        "https://example.invalid/",
      ).searchParams.get("p");
      const displayName = link.text().trim();

      const country = $(cells[3]).text().trim() || null;
      const points = Number($(cells[4]).text().trim());
      const smallTrnText = $(cells[5]).text().trim();
      const smallTrn = smallTrnText === "" ? null : Number(smallTrnText);

      if (!externalId || Number.isNaN(rank) || Number.isNaN(points)) return;

      rows.push({
        rank,
        moved,
        player: { externalId, displayName },
        country,
        points,
        smallTrn,
      });
    });

  return RankingPageSchema.parse({ isoYear, isoWeek, rows });
}
