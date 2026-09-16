/**
 * Índice de velocidad de pista por torneo — pedido explícito (2026-09-17): las
 * preguntas de la mini-entrevista (lib/newsGeneration/interviewQuestions.ts)
 * mencionaban la superficie de forma genérica ("the blue-green cement can be a tricky
 * surface"), sin ningún dato real que la respalde. Este fichero le da a esa pregunta
 * algo concreto: el Court Pace Index (un número real, ej. 37.5) y su categoría de
 * velocidad (Slow/Medium/Fast...) por torneo, sacados de
 * `public/speeds_index/*.csv` — la configuración de físicas real del propio juego.
 *
 * El CSV no comparte ningún id con nuestro esquema (sus números de fila son una
 * plantilla interna del juego, no el `Trn=` de Mana Games) — el único enlace posible
 * es el NOMBRE del torneo, así que la búsqueda es por coincidencia de nombre, nunca
 * por id. Mismo criterio que namesRelate (app/account/actions.ts): cero o varias
 * coincidencias y no se adivina, solo una inequívoca cuenta.
 */
import fs from "node:fs";
import path from "node:path";

export interface CourtPhysicsEntry {
  tournamentLabel: string;
  courtPaceIndex: number;
  speedCategory: string;
  physicsSurface: string;
}

const CSV_PATH = path.join(process.cwd(), "public", "speeds_index", "TE-4-XKT-court-physics-_updated-v4.3_-_2_.csv");

// Los nombres del CSV llevan el género/categoría del cuadro pegado al final ("Miami
// ATP 1000") — nuestros `events.displayName` no lo hacen (esa parte ya vive aparte en
// `editions.category`), así que hay que quitarlo para poder comparar los dos nombres
// como el mismo torneo.
const CATEGORY_SUFFIXES = [" ATP 1000", " WTA 1000", " ATP 500", " WTA 500", " ATP 250", " WTA 250", " WTA 125"];

function stripLeadingCode(raw: string): string {
  return raw.replace(/^\d+\s*/, "").trim();
}

function stripCategorySuffix(name: string): string {
  for (const suffix of CATEGORY_SUFFIXES) {
    if (name.endsWith(suffix)) return name.slice(0, -suffix.length).trim();
  }
  return name;
}

/** Sin guiones/apóstrofos y en minúsculas antes de comparar — "Monte-Carlo" (nuestro
 * `events.displayName`) vs "Monte Carlo" (el CSV) o "Winston-Salem" vs "Winston
 * Salem" son el mismo torneo, solo puntuación distinta. */
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/['''-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El CSV nombra unos pocos torneos de forma que ninguna normalización de puntuación
 * arregla sola — el nombre real en italiano ("Roma"), o el código corto que usa el
 * propio juego para un Grand Slam ("AO Rod Laver", "RG Philippe Chatrier") en vez del
 * nombre completo que sí usa `events.displayName`. `[TE4]` en un nombre de evento es
 * una anotación nuestra, no parte del nombre del torneo — se quita igual que un
 * sufijo de categoría. */
const NAME_ALIASES: Record<string, string> = {
  "rome": "roma",
  "australian open": "ao rod laver",
  "roland garros": "rg philippe chatrier",
  "roland garros [te4]": "rg philippe chatrier",
};

/** Cada campo del CSV va entre comillas, sin comillas ni comas escapadas dentro —
 * confirmado leyendo el fichero entero a mano, no hace falta un parser de verdad. */
function parseCsvLine(line: string): string[] {
  return line.trim().slice(1, -1).split('","');
}

let cache: CourtPhysicsEntry[] | null = null;

function loadAll(): CourtPhysicsEntry[] {
  if (cache) return cache;

  let raw: string;
  try {
    raw = fs.readFileSync(CSV_PATH, "utf-8");
  } catch {
    cache = [];
    return cache;
  }

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  cache = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      tournamentLabel: stripCategorySuffix(stripLeadingCode(cols[0])),
      courtPaceIndex: Number(cols[8]),
      speedCategory: cols[9],
      physicsSurface: cols[10],
    };
  });
  return cache;
}

/** Varios torneos reales tienen más de una fila en el CSV — el propio género (ATP
 * 1000 / WTA 1000 de la misma ciudad, ya sin el sufijo) o distinta pista/sesión de un
 * Grand Slam ("Wimbledon Center Court Day" / "Wimbledon No.1 Court") — pero SIEMPRE
 * la misma pista física real detrás. Si todas las filas candidatas coinciden en los
 * tres campos que de verdad importan aquí, es la misma respuesta aunque haya varias
 * filas; si de verdad discrepan (dos torneos distintos que solo comparten una
 * palabra), es una ambigüedad real y no se adivina cuál. */
function allAgree(rows: CourtPhysicsEntry[]): boolean {
  return rows.every(
    (r) => r.courtPaceIndex === rows[0].courtPaceIndex && r.speedCategory === rows[0].speedCategory && r.physicsSurface === rows[0].physicsSurface,
  );
}

/**
 * El CSV no comparte ningún id con nuestro esquema — la única forma de encontrar un
 * torneo es por el nombre. Cero coincidencias, o varias que de verdad discrepan, y no
 * se sugiere nada, igual que el resto del sitio con este tipo de comparación
 * (namesRelate en app/account/actions.ts).
 */
export function getCourtPhysicsForTournament(eventName: string): CourtPhysicsEntry | null {
  const cleaned = normalizeForMatch(eventName);
  if (!cleaned) return null;
  const normalized = NAME_ALIASES[cleaned] ?? cleaned;

  const all = loadAll();
  const exact = all.filter((r) => normalizeForMatch(r.tournamentLabel) === normalized);
  if (exact.length > 0) return allAgree(exact) ? exact[0] : null;

  const partial = all.filter((r) => {
    const label = normalizeForMatch(r.tournamentLabel);
    return label.includes(normalized) || normalized.includes(label);
  });
  return partial.length > 0 && allAgree(partial) ? partial[0] : null;
}
