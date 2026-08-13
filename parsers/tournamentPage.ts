import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import {
  TournamentPageSchema,
  type ParsedTournamentPage,
  type ParsedMatch,
  type ParsedSet,
  type ParsedEdition,
  type Outcome,
  type PlayerRef,
} from "./schemas";

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function parseWeekLabel(
  weekText: string,
  year: number,
): { isoWeek: number | null; weekStartDate: string | null } {
  // "33 - Monday August 16th"
  const [weekPart, datePart] = weekText.split(" - ").map((s) => s.trim());
  const isoWeek = Number(weekPart);
  if (!datePart) return { isoWeek: Number.isNaN(isoWeek) ? null : isoWeek, weekStartDate: null };

  const dateMatch = datePart.match(/^\w+\s+(\w+)\s+(\d+)(?:st|nd|rd|th)?$/i);
  if (!dateMatch) return { isoWeek: Number.isNaN(isoWeek) ? null : isoWeek, weekStartDate: null };

  const month = MONTHS[dateMatch[1].toLowerCase()];
  const day = Number(dateMatch[2]);
  if (!month) return { isoWeek: Number.isNaN(isoWeek) ? null : isoWeek, weekStartDate: null };

  const weekStartDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { isoWeek: Number.isNaN(isoWeek) ? null : isoWeek, weekStartDate };
}

interface CellData {
  isBye: boolean;
  player: PlayerRef | null;
  scoreText: string;
}

function extractCell($: CheerioAPI, td: Element): CellData {
  const $td = $(td);
  const link = $td.find("a").first();

  const scoreSpan = $td.find("span.score").first();
  const scoreText = scoreSpan.text().replace(/\s+/g, " ").trim();

  const withoutScore = $td.clone();
  withoutScore.find("span.score").remove();
  const nameAreaText = withoutScore.text().replace(/\s+/g, " ").trim();

  if (link.length === 0) {
    const isBye = nameAreaText.toLowerCase().startsWith("bye");
    return { isBye, player: null, scoreText };
  }

  const displayName = link.text().trim();
  const href = link.attr("href") ?? "";
  const externalId = new URL(href, "https://example.invalid/").searchParams.get("p");
  const seedMatch = nameAreaText.slice(displayName.length).match(/\((\d+)\)/);
  const seed = seedMatch ? Number(seedMatch[1]) : null;

  if (!externalId) {
    return { isBye: false, player: null, scoreText };
  }

  return { isBye: false, player: { externalId, displayName, seed }, scoreText };
}

/** Expande una tabla de cuadro (con rowspans) en una rejilla hoja×columna. */
function buildGrid($: CheerioAPI, table: Cheerio<Element>): CellData[][] {
  const headers = table
    .find("thead tr")
    .first()
    .find("th.Large")
    .toArray()
    .map((th) => $(th).text().trim());
  const numCols = headers.length;

  const bodyRows = table
    .find("tbody tr")
    .toArray()
    .filter((tr) => $(tr).find("td").length > 0 && $(tr).find("td.Points").length === 0);

  const active: (CellData | null)[] = new Array(numCols).fill(null);
  const remaining: number[] = new Array(numCols).fill(0);
  const grid: CellData[][] = [];

  for (const tr of bodyRows) {
    const tds = $(tr).find("> td").toArray();
    let tdCursor = 0;
    const row: CellData[] = [];
    for (let col = 0; col < numCols; col++) {
      if (remaining[col] <= 0) {
        const td = tds[tdCursor++];
        const cell = td ? extractCell($, td) : { isBye: true, player: null, scoreText: "" };
        const rowspan = td ? Number($(td).attr("rowspan") ?? "1") : 1;
        active[col] = cell;
        remaining[col] = rowspan;
      }
      row.push(active[col]!);
    }
    grid.push(row);
    for (let col = 0; col < numCols; col++) remaining[col]--;
  }

  return grid;
}

// Variantes de walkover vistas en datos reales: "w.o." (fase 1), pero también "WO" y
// "w.o" sin punto final (~730 partidos del backfill completo, sobre todo 2021-2022).
const WALKOVER_TEXTS = new Set(["w.o.", "w.o", "wo"]);
// "RL" = "Random Luck": la comunidad TE4 resuelve así un emparejamiento que no llegó a
// jugarse (no es walkover ni retirada ni descalificación — confirmado con el propietario
// del proyecto, no es una categoría que debamos inventar ni fundir con las demás).
const RANDOM_LUCK_TEXT = "RL";

export function parseScoreText(scoreText: string): { outcome: Outcome; sets: ParsedSet[] } {
  if (WALKOVER_TEXTS.has(scoreText.toLowerCase())) return { outcome: "walkover", sets: [] };
  if (scoreText === "DISQ") return { outcome: "disqualified", sets: [] };
  if (scoreText === RANDOM_LUCK_TEXT) return { outcome: "random", sets: [] };

  const retMatch = scoreText.match(/^(.*?)\s*ret\.$/);
  const outcome: Outcome = retMatch ? "retired" : "played";
  const scorePart = retMatch ? retMatch[1].trim() : scoreText;

  const sets: ParsedSet[] = [];
  const tokens = scorePart.split(/\s+/).filter(Boolean);
  tokens.forEach((token, i) => {
    const m = token.match(/^(\d+)\/(\d+)(?:\((\d+)\))?$/);
    if (!m) return;
    sets.push({
      setNumber: i + 1,
      winnerGames: Number(m[1]),
      loserGames: Number(m[2]),
      tiebreakLoserPoints: m[3] ? Number(m[3]) : null,
    });
  });

  return { outcome, sets };
}

function extractMatchesFromTable($: CheerioAPI, table: Cheerio<Element>): ParsedMatch[] {
  const headers = table
    .find("thead tr")
    .first()
    .find("th.Large")
    .toArray()
    .map((th) => $(th).text().trim());
  const numCols = headers.length;
  if (numCols < 2) return [];

  const grid = buildGrid($, table);
  const matches: ParsedMatch[] = [];

  for (let c = 0; c < numCols - 1; c++) {
    const round = headers[c];
    let groupStart = 0;
    while (groupStart < grid.length) {
      const bridge = grid[groupStart][c + 1];
      let groupEnd = groupStart;
      while (groupEnd < grid.length && grid[groupEnd][c + 1] === bridge) groupEnd++;

      const entrants: CellData[] = [];
      for (let r = groupStart; r < groupEnd; r++) {
        const cell = grid[r][c];
        if (!entrants.some((e) => e === cell)) entrants.push(cell);
      }

      if (entrants.length === 2 && !entrants[0].isBye && !entrants[1].isBye) {
        const [a, b] = entrants;
        if (a.player && b.player && bridge.player) {
          const { outcome, sets } = parseScoreText(bridge.scoreText);
          matches.push({
            round,
            player1: a.player,
            player2: b.player,
            winnerExternalId: bridge.player.externalId,
            outcome,
            scoreRaw: bridge.scoreText || null,
            sets,
          });
        }
      }

      groupStart = groupEnd;
    }
  }

  return matches;
}

function parseMetadata($: CheerioAPI): {
  edition: Omit<ParsedEdition, "isoWeek" | "weekStartDate" | "externalId" | "year">;
  year: number;
  weekLabel: string;
} {
  const h2 = $("h2").first().text().trim();
  const nameMatch = h2.match(/View Tournament:\s*(.+?)(?:\s*\(|$)/);
  const eventName = nameMatch ? nameMatch[1].trim() : h2;
  const officialTopicUrl = $("h2").first().find("a").first().attr("href") ?? null;

  const metaTable = $("table.Ot")
    .filter((_, t) => $(t).find("thead th").first().text().trim() === "Competition")
    .first();
  const cells = metaTable.find("tbody tr").first().find("td");
  const val = (i: number) => $(cells[i]).text().trim();

  const competition = val(0);
  const drawSize = Number(val(1));
  const [queueCountStr, queueCapacityStr] = val(2).split("/").map((s) => s.trim());
  const seedsStr = val(3);
  const surface = val(4);
  const category = val(5);
  const weekLabel = val(6);
  const year = Number(val(7));

  return {
    year,
    weekLabel,
    edition: {
      eventName,
      surface,
      category,
      competition,
      drawSize,
      queueCount: queueCountStr ? Number(queueCountStr) : null,
      queueCapacity: queueCapacityStr ? Number(queueCapacityStr) : null,
      seeds: seedsStr ? Number(seedsStr) : null,
      officialTopicUrl,
    },
  };
}

/** HTML de OT_ViewTournament.php -> edición + partidos (Main Draw + Qualifications). */
export function parseTournamentPage(html: string, externalId: string): ParsedTournamentPage {
  const $ = cheerio.load(html);

  const { edition: partialEdition, year, weekLabel } = parseMetadata($);
  const { isoWeek, weekStartDate } = parseWeekLabel(weekLabel, year);

  const edition: ParsedEdition = {
    ...partialEdition,
    externalId,
    year,
    isoWeek,
    weekStartDate,
  };

  const matches: ParsedMatch[] = [];
  for (const label of ["Main Draw", "Qualifications"]) {
    const dl = $("dt")
      .filter((_, dt) => $(dt).text().trim() === label)
      .first()
      .closest("dl.Ot");
    dl.find("table.Ot").each((_, table) => {
      matches.push(...extractMatchesFromTable($, $(table)));
    });
  }

  return TournamentPageSchema.parse({ edition, matches });
}
