/**
 * `MatchLog - <perfil>.NNN.html` — el histórico local de partidos de TE4 (no de Mana
 * Games). Un jugador puede subir varios ficheros numerados (001, 002...); cada uno se
 * parsea por separado con esta función.
 *
 * Solo se producen entradas `[Online]` (partido real contra otro humano, con ELO en
 * los dos lados) — todo lo demás (práctica offline, contra IA `(Incredible-N)`,
 * contra "leyendas" `[Fake] ...`) se descarta aquí mismo, antes de intentar casar
 * nombres de jugador contra la base de datos (`lib/matchLog/linkToTourMatch.ts` hace
 * eso a partir de lo que esta función deje pasar). Es el filtro que separa "podría
 * ser un partido real del tour" de "seguro que no lo es".
 */
import * as cheerio from "cheerio";
import {
  MatchLogPageSchema,
  type ParsedMatchLogPage,
  type ParsedMatchLogEntry,
  type ParsedMatchLogPlayerStats,
  type ParsedSet,
} from "./schemas";

export interface SkippedMatchLogEntry {
  raw: string;
  reason: string;
}

export interface MatchLogParseResult {
  page: ParsedMatchLogPage;
  skipped: SkippedMatchLogEntry[];
}

const MPH_TO_KMH = 1.60934;
const ONLINE_TAG = "[Online]";

function parseSpeedCell(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(Km\/h|Mph)$/i.exec(text.trim());
  if (!m) return null;
  const value = Number(m[1]);
  if (Number.isNaN(value)) return null;
  return Math.round(m[2].toLowerCase() === "mph" ? value * MPH_TO_KMH : value);
}

function parseFraction(text: string): { num: number; den: number } | null {
  // "24 / 43 = 56%"
  const m = /^(\d+)\s*\/\s*(\d+)\s*=/.exec(text.trim());
  if (!m) return null;
  return { num: Number(m[1]), den: Number(m[2]) };
}

function parseSingleInt(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

type StatField = keyof ParsedMatchLogPlayerStats;

// Etiquetas tal como aparecen en la celda `c1`/`c2` de la fuente, normalizadas a
// mayúsculas para no depender de mayúsculas/minúsculas exactas del fichero.
const FRACTION_FIELDS: Record<string, [num: StatField, den: StatField]> = {
  "1ST SERVE %": ["firstServeIn", "firstServeAttempted"],
  "1ST SERVE WON %": ["firstServePointsWon", "firstServePointsPlayed"],
  "2ND SERVE WON %": ["secondServePointsWon", "secondServePointsPlayed"],
  "RETURN POINTS WON": ["returnPointsWon", "returnPointsPlayed"],
  "NET POINTS WON": ["netPointsWon", "netPointsPlayed"],
  "BREAK POINTS WON": ["breakPointsWon", "breakPointsFaced"],
};

const SINGLE_INT_FIELDS: Record<string, StatField> = {
  ACES: "aces",
  "DOUBLE FAULTS": "doubleFaults",
  WINNERS: "winners",
  "FORCED ERRORS": "forcedErrors",
  "UNFORCED ERRORS": "unforcedErrors",
  "TOTAL POINTS WON": "totalPointsWon",
};

const SPEED_FIELDS: Record<string, StatField> = {
  "FASTEST SERVE": "fastestServeKmh",
  "AVG 1ST SERVE SPEED": "avgFirstServeSpeedKmh",
  "AVG 2ND SERVE SPEED": "avgSecondServeSpeedKmh",
};

// Filas que existen en el fichero fuente pero que esta primera versión no guarda
// (rachas de peloteo, puntos de set/partido salvados, ganadores de resto, breaks por
// juego) se ignoran sin más: ninguna etiqueta desconocida rompe el parseo.

function emptyStats(): ParsedMatchLogPlayerStats {
  return {
    aces: null,
    doubleFaults: null,
    firstServeAttempted: null,
    firstServeIn: null,
    firstServePointsPlayed: null,
    firstServePointsWon: null,
    secondServePointsPlayed: null,
    secondServePointsWon: null,
    breakPointsFaced: null,
    breakPointsWon: null,
    returnPointsPlayed: null,
    returnPointsWon: null,
    netPointsPlayed: null,
    netPointsWon: null,
    winners: null,
    forcedErrors: null,
    unforcedErrors: null,
    totalPointsWon: null,
    fastestServeKmh: null,
    avgFirstServeSpeedKmh: null,
    avgSecondServeSpeedKmh: null,
  };
}

function applyRow(
  p1Text: string,
  label: string,
  p2Text: string,
  p1: ParsedMatchLogPlayerStats,
  p2: ParsedMatchLogPlayerStats,
): void {
  const key = label.trim().toUpperCase();

  const fraction = FRACTION_FIELDS[key];
  if (fraction) {
    const [numField, denField] = fraction;
    const f1 = parseFraction(p1Text);
    const f2 = parseFraction(p2Text);
    if (f1) {
      p1[numField] = f1.num;
      p1[denField] = f1.den;
    }
    if (f2) {
      p2[numField] = f2.num;
      p2[denField] = f2.den;
    }
    return;
  }

  const single = SINGLE_INT_FIELDS[key];
  if (single) {
    const v1 = parseSingleInt(p1Text);
    const v2 = parseSingleInt(p2Text);
    if (v1 !== null) p1[single] = v1;
    if (v2 !== null) p2[single] = v2;
    return;
  }

  const speed = SPEED_FIELDS[key];
  if (speed) {
    const v1 = parseSpeedCell(p1Text);
    const v2 = parseSpeedCell(p2Text);
    if (v1 !== null) p1[speed] = v1;
    if (v2 !== null) p2[speed] = v2;
  }
}

interface HeaderInfo {
  player1Name: string;
  player2Name: string;
  scoreRaw: string;
  playedAt: Date;
}

type ParseOutcome<T> = T | { error: string };

function splitNameAndDetail(text: string): { name: string; detail: string | null } {
  const trimmed = text.trim();
  if (trimmed.endsWith(")")) {
    const openIdx = trimmed.lastIndexOf("(");
    if (openIdx > 0) {
      return { name: trimmed.slice(0, openIdx).trim(), detail: trimmed.slice(openIdx + 1, -1).trim() };
    }
  }
  return { name: trimmed, detail: null };
}

function parseHeader(rawText: string): ParseOutcome<HeaderInfo> {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text.endsWith(ONLINE_TAG)) return { error: "not an online match" };
  const withoutTag = text.slice(0, -ONLINE_TAG.length).trim();

  const defIdx = withoutTag.indexOf(" def. ");
  if (defIdx === -1) return { error: "missing ' def. ' separator" };
  const leftRaw = withoutTag.slice(0, defIdx);
  const afterDef = withoutTag.slice(defIdx + " def. ".length);

  const colonIdx = afterDef.indexOf(" : ");
  if (colonIdx === -1) return { error: "missing ' : ' separator" };
  const rightRaw = afterDef.slice(0, colonIdx);
  const tailRaw = afterDef.slice(colonIdx + " : ".length);

  const { name: player1Name, detail: detail1 } = splitNameAndDetail(leftRaw);
  const { name: player2Name, detail: detail2 } = splitNameAndDetail(rightRaw);
  if (!detail1 || !detail2) return { error: "online match missing player detail" };
  if (!player1Name || !player2Name) return { error: "empty player name" };

  const parts = tailRaw.split(" - ");
  if (parts.length < 4) return { error: "unexpected tail shape" };
  const scoreRaw = parts[0];
  const dateTimeRaw = parts[parts.length - 1];

  const dtMatch = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/.exec(dateTimeRaw.trim());
  if (!dtMatch) return { error: "unparseable date/time" };
  const playedAt = new Date(`${dtMatch[1]}T${dtMatch[2]}:00`);
  if (Number.isNaN(playedAt.getTime())) return { error: "invalid date" };

  return { player1Name, player2Name, scoreRaw, playedAt };
}

interface ScoreInfo {
  sets: ParsedSet[];
  outcome: "played" | "retired";
}

function parseScore(scoreRaw: string): ParseOutcome<ScoreInfo> {
  const tokens = scoreRaw.trim().split(/\s+/);
  let outcome: "played" | "retired" = "played";
  let setTokens = tokens;
  const last = tokens[tokens.length - 1];
  if (last && /^ret\.?$/i.test(last)) {
    outcome = "retired";
    setTokens = tokens.slice(0, -1);
  }
  if (setTokens.length === 0) return { error: "no sets in score" };

  const sets: ParsedSet[] = [];
  for (let i = 0; i < setTokens.length; i++) {
    const m = /^(\d+)\/(\d+)(?:\((\d+)\))?$/.exec(setTokens[i]);
    if (!m) return { error: `unparseable set token "${setTokens[i]}"` };
    // El primer número de cada set es SIEMPRE el del ganador del partido (player1,
    // "X def. Y"), aunque haya perdido ese set concreto — NUNCA Math.max/min: eso
    // asume que el ganador del partido gana todos sus sets, y lo desordena justo en el
    // set que de verdad importa (uno perdido en la muerte súbita, p.ej. "6/7(7)" real,
    // donde el ganador del partido se quedó con 6 games). Mismo criterio que ya usa
    // `sets`/`scoreRaw` en el resto de la web — ver lib/matchScore.ts.
    sets.push({
      setNumber: i + 1,
      winnerGames: Number(m[1]),
      loserGames: Number(m[2]),
      tiebreakLoserPoints: m[3] !== undefined ? Number(m[3]) : null,
    });
  }
  return { sets, outcome };
}

export function parseMatchLogPage(html: string): MatchLogParseResult {
  const $ = cheerio.load(html);
  const entries: ParsedMatchLogEntry[] = [];
  const skipped: SkippedMatchLogEntry[] = [];

  $("table[id]").each((_, table) => {
    const $table = $(table);
    const header = $table.prev("p").text();

    const headerResult = parseHeader(header);
    if ("error" in headerResult) {
      // "not an online match" es, con muchísima diferencia, el caso normal (práctica,
      // partidos contra IA) — no merece la pena registrarlo como si fuera un fallo.
      if (headerResult.error !== "not an online match") {
        skipped.push({ raw: header.trim(), reason: headerResult.error });
      }
      return;
    }

    const scoreResult = parseScore(headerResult.scoreRaw);
    if ("error" in scoreResult) {
      skipped.push({ raw: header.trim(), reason: scoreResult.error });
      return;
    }

    const player1Stats = emptyStats();
    const player2Stats = emptyStats();
    $table.find("tr").each((__, tr) => {
      const tds = $(tr)
        .find("td")
        .map((___, td) => $(td).text())
        .get();
      if (tds.length === 7) {
        applyRow(tds[0], tds[1], tds[2], player1Stats, player2Stats);
        applyRow(tds[4], tds[5], tds[6], player1Stats, player2Stats);
      } else if (tds.length === 3) {
        applyRow(tds[0], tds[1], tds[2], player1Stats, player2Stats);
      }
    });

    entries.push({
      player1Name: headerResult.player1Name,
      player2Name: headerResult.player2Name,
      outcome: scoreResult.outcome,
      sets: scoreResult.sets,
      playedAt: headerResult.playedAt,
      player1Stats,
      player2Stats,
    });
  });

  return { page: MatchLogPageSchema.parse({ entries }), skipped };
}
