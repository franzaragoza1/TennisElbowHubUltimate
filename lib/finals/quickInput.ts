/**
 * "Quick Input": pegar resultados en texto plano y que el sistema los reconozca, en
 * vez de rellenar un formulario set a set. Deliberadamente tolerante con el formato
 * (`/` o `-` como separador, `def.`/`d.`/`bt.` como conector) porque nadie va a pegar
 * el texto exactamente igual dos veces.
 *
 * Solo hace texto -> estructura. La resolución de nombre -> `playerId` vive en la
 * capa de acción de servidor, porque necesita consultar quiénes son los participantes
 * de esta edición — este módulo no toca la base de datos para poder probarse con
 * fixtures.
 */
const OUTCOME_SUFFIX = /\s+(ret\.?|retired|w\.?o\.?|walkover)\s*$/i;
const LINE = /^(.+?)\s+(?:def\.?|d\.|bt\.?)\s+(.+?)\s+((?:\d{1,2}[/-]\d{1,2}(?:\(\d{1,2}\))?\s*)+)$/i;
const SET = /(\d{1,2})[/-](\d{1,2})(?:\((\d{1,2})\))?/g;

export interface ParsedQuickResult {
  winnerName: string;
  loserName: string;
  outcome: "played" | "retired" | "walkover";
  sets: { winnerGames: number; loserGames: number; tiebreakLoserPoints: number | null }[];
}

/** Ej: "M. Arnaldi def. J.I 6/4 7/6(5)" o "lord goatic d. Tomico 6-2 3-6 6-4 ret." */
export function parseQuickResultLine(rawLine: string): ParsedQuickResult | null {
  let line = rawLine.trim();
  let outcome: ParsedQuickResult["outcome"] = "played";

  const suffixMatch = OUTCOME_SUFFIX.exec(line);
  if (suffixMatch) {
    outcome = /^w/i.test(suffixMatch[1]) ? "walkover" : "retired";
    line = line.slice(0, suffixMatch.index).trim();
  }

  const m = LINE.exec(line);
  if (!m) return null;

  const [, winnerName, loserName, scoreBlock] = m;
  const sets = [...scoreBlock.matchAll(SET)].map((s) => ({
    winnerGames: Number(s[1]),
    loserGames: Number(s[2]),
    tiebreakLoserPoints: s[3] ? Number(s[3]) : null,
  }));
  if (sets.length === 0) return null;

  return { winnerName: winnerName.trim(), loserName: loserName.trim(), outcome, sets };
}

export interface QuickInputLineResult {
  lineNumber: number;
  raw: string;
  parsed: ParsedQuickResult | null;
  error: string | null;
}

/**
 * Parsea el textarea completo, un resultado por línea. Nunca lanza: una línea que no
 * encaja se marca con su propio error para que el admin la corrija a mano, en vez de
 * descartar el pegado entero por un resultado mal escrito.
 */
export function parseQuickInputBlock(text: string): QuickInputLineResult[] {
  return text
    .split("\n")
    .map((raw, i) => ({ raw, lineNumber: i + 1 }))
    .filter(({ raw }) => raw.trim().length > 0)
    .map(({ raw, lineNumber }) => {
      const parsed = parseQuickResultLine(raw);
      return {
        lineNumber,
        raw,
        parsed,
        error: parsed ? null : 'Could not parse — expected "Player1 def. Player2 6/4 6/1"',
      };
    });
}
