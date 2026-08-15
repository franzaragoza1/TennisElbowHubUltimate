import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";

export interface RawLivePlayer {
  name: string;
  /** Juegos ganados en cada set que ya ha empezado (incluido el que está en curso) —
   * los slots de sets futuros (huecos, `class="hidden"` y vacíos) no entran aquí. */
  setGames: string[];
  /** Punto del juego en curso ("0"/"15"/"30"/"40"/"Ad"...) — cadena tal cual la da la
   * fuente, nunca se interpreta ni se convierte. */
  currentPoint: string;
  serving: boolean;
}

export interface RawLiveMatch {
  matchId: string;
  courtTitle: string;
  bestOf: number;
  player1: RawLivePlayer;
  player2: RawLivePlayer;
}

/** Texto propio de un elemento, sin el de sus hijos (p.ej. el nombre del jugador,
 * excluyendo el `<odds>` de al lado con su elo). */
function ownText($el: Cheerio<Element>): string {
  return $el.clone().children().remove().end().text().trim();
}

function parsePlayerRow($: CheerioAPI, tr: Element): RawLivePlayer | null {
  const $tr = $(tr);
  const $td = $tr.find("td").first();
  if ($td.length === 0) return null;
  const name = ownText($td);
  if (!name) return null;

  // Estructura real (ver docs de reconocimiento, lib/liveTennis/__fixtures__/live-te.html):
  // <td>Nombre <odds>elo: N</odds> <div>[div set1][div.hidden set2..5][div punto]</div></td>
  const wrapper = $td.children("div").first();
  const cells = wrapper.children("div");
  const setGames = cells
    .slice(0, 5)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t !== "");
  const currentPoint = cells.length > 5 ? $(cells.get(5)).text().trim() : "";

  return {
    name,
    setGames,
    currentPoint,
    serving: ($tr.attr("class") ?? "").includes("Serve"),
  };
}

/**
 * Parsea `https://www.live-tennis.cn/zh/te` (bolsa de TODO partido TE4 en vivo, no solo
 * los del tour XKT — el filtrado a nuestro tour es responsabilidad de
 * `filterCandidates`/`resolveAgainstOngoing`, no de este parser). Función pura,
 * HTML -> objetos, sin red — misma disciplina que `parsers/*.ts` para Mana Games.
 */
export function parseLivePage(html: string): RawLiveMatch[] {
  const $ = cheerio.load(html);
  const results: RawLiveMatch[] = [];

  $(".cResultCourt").each((_, court) => {
    const $court = $(court);
    const courtTitle = $court.find(".cResultCourtTitle").first().text().trim();
    if (!courtTitle) return;

    $court.find(".cResultMatch").each((_, matchEl) => {
      const $match = $(matchEl);
      const bestOfRaw = $match.attr("best-of");
      const bestOf = bestOfRaw ? Number(bestOfRaw) : NaN;
      const matchId = $match.attr("match-id") ?? "";
      const rows = $match.find(".cResultMatchMid table tbody tr").toArray();
      if (rows.length !== 2 || Number.isNaN(bestOf)) return;

      const player1 = parsePlayerRow($, rows[0]);
      const player2 = parsePlayerRow($, rows[1]);
      if (!player1 || !player2) return;

      results.push({ matchId, courtTitle, bestOf, player1, player2 });
    });
  });

  return results;
}
