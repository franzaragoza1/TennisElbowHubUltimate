/**
 * Backfill 2021-2026 (fase 2, CLAUDE.md sección 5 / 7).
 *
 * Archiva en crudo, sin parsear nada, los índices anuales, los cuadros de torneo y el
 * ranking Singles Entry semanal del Online Tour de Mana Games. Reanudable: el progreso
 * vive en una cola SQLite (data/scrape-queue.sqlite), así que se puede parar (Ctrl+C) y
 * volver a lanzar sin perder trabajo ni repetir páginas ya descargadas.
 *
 * Uso:
 *   npm run backfill                                  histórico completo 2021-hoy
 *   npm run backfill -- --week=2026-32                solo esa semana ISO (torneos + ranking)
 *   npm run backfill -- --from=2026-30 --to=2026-35    ese rango de semanas ISO (inclusive)
 *   npm run backfill -- --week=2026-32 --official-only solo ranking oficial (Race=0), sin Race
 *   npm run backfill -- --tournament=2095              solo ese Trn=, sin tocar rankings
 *
 * Con --week/--from/--to, el scraper sigue visitando el índice anual completo de cada
 * año implicado (es la única forma de descubrir qué torneos caen en esa semana — ver
 * docs/estructura.md sección 1), pero solo encola los torneos y las semanas de ranking
 * que caen dentro del filtro. Se puede repetir sobre una cola ya completada: usa
 * INSERT OR IGNORE, así que no duplica ni reprocesa lo que ya está 'done'.
 *
 * --official-only encola solo `OT_Rankings.php?...&Race=0` (el ranking de siempre) y
 * se salta `Race=1` (la Race). Sin este flag se encolan los dos, como hasta ahora.
 *
 * --tournament=<Trn> encola directamente `OT_ViewTournament.php?Trn=<Trn>`, sin pasar
 * por ningún índice anual (el id ya es la URL completa, no hace falta descubrirlo) ni
 * tocar el ranking. Incompatible con --week/--from/--to/--official-only: son dos modos
 * distintos (por semana o por torneo suelto), no se combinan.
 */
import { chromium, type Page } from "playwright";
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://www.managames.com/Forum";
const USER_AGENT = "TE4TourBot/0.1 (+mailto:thelolosmusica@gmail.com)";
const USER_DATA_DIR = path.resolve(".playwright");
const RAW_DIR = path.resolve("data/raw/mana");
const DB_PATH = path.resolve("data/scrape-queue.sqlite");
const REQUEST_DELAY_MS = 8_000;
const CHALLENGE_TIMEOUT_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;
const START_YEAR = 2021;
const CURRENT_YEAR = new Date().getFullYear();

const CHALLENGE_MARKERS = [
  "just a moment",
  "checking your browser",
  "ddos protection",
  "verificando",
  "un momento",
  "please wait",
  "attention required",
  "cloudflare",
  "access denied",
];

type QueueKind = "tournament_index" | "ranking_index" | "tournament" | "ranking";

interface QueueRow {
  id: number;
  kind: QueueKind;
  url: string;
  file_path: string;
  status: string;
  attempts: number;
}

interface IsoWeek {
  year: number;
  week: number;
}

/** Filtro opcional de semanas ISO pedido por CLI. `null` = sin filtro (histórico completo). */
interface WeekFilter {
  from: IsoWeek;
  to: IsoWeek;
}

function weekKey(w: IsoWeek): number {
  return w.year * 100 + w.week;
}

function parseIsoWeekArg(raw: string, flag: string): IsoWeek {
  const m = /^(\d{4})-(\d{1,2})$/.exec(raw.trim());
  if (!m) throw new Error(`${flag} debe tener forma AAAA-WW (p. ej. 2026-32), recibido "${raw}"`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) throw new Error(`${flag}: semana ISO fuera de rango (1-53): ${week}`);
  return { year, week };
}

interface CliOptions {
  weekFilter: WeekFilter | null;
  officialOnly: boolean;
  tournamentId: string | null;
}

function parseCliArgs(argv: string[]): CliOptions {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit?.slice(prefix.length);
  };

  const single = get("week");
  const from = get("from");
  const to = get("to");
  const officialOnly = argv.includes("--official-only");
  const tournamentRaw = get("tournament");

  if (tournamentRaw) {
    if (single || from || to || officialOnly) {
      throw new Error("--tournament no se combina con --week/--from/--to/--official-only: son modos distintos.");
    }
    if (!/^\d+$/.test(tournamentRaw.trim())) {
      throw new Error(`--tournament debe ser el número de Trn= (p. ej. 2095), recibido "${tournamentRaw}"`);
    }
    return { weekFilter: null, officialOnly: false, tournamentId: tournamentRaw.trim() };
  }

  if (single && (from || to)) {
    throw new Error("Usa --week=AAAA-WW o --from/--to, no ambos a la vez.");
  }
  if (single) {
    const w = parseIsoWeekArg(single, "--week");
    return { weekFilter: { from: w, to: w }, officialOnly, tournamentId: null };
  }
  if (from || to) {
    if (!from || !to) throw new Error("--from y --to van juntos.");
    const fromWeek = parseIsoWeekArg(from, "--from");
    const toWeek = parseIsoWeekArg(to, "--to");
    if (weekKey(fromWeek) > weekKey(toWeek)) throw new Error("--from debe ser anterior o igual a --to.");
    return { weekFilter: { from: fromWeek, to: toWeek }, officialOnly, tournamentId: null };
  }
  return { weekFilter: null, officialOnly, tournamentId: null };
}

function weekInFilter(w: IsoWeek, filter: WeekFilter | null): boolean {
  if (!filter) return true;
  const k = weekKey(w);
  return k >= weekKey(filter.from) && k <= weekKey(filter.to);
}

function yearsInFilter(filter: WeekFilter): number[] {
  const years: number[] = [];
  for (let y = filter.from.year; y <= filter.to.year; y++) years.push(y);
  return years;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Duplicado deliberadamente de scripts/explore.ts (ya aprobado, no se toca). */
async function waitOutChallenge(page: Page, label: string): Promise<void> {
  const start = Date.now();
  let warned = false;
  while (Date.now() - start < CHALLENGE_TIMEOUT_MS) {
    const resolved = await page.evaluate((markers) => {
      const text = (document.body?.innerText ?? "").toLowerCase();
      const looksLikeChallenge = markers.some((m) => text.includes(m));
      return document.readyState === "complete" && !looksLikeChallenge && text.length > 500;
    }, CHALLENGE_MARKERS);
    if (resolved) return;
    if (!warned) {
      console.log(
        `  ⚠ [${label}] Challenge anti-bot en pantalla. Resuélvelo en la ventana de ` +
          `Chromium; el script sigue comprobando solo.`,
      );
      warned = true;
    }
    await sleep(3_000);
  }
  throw new Error(`[${label}] El challenge no se resolvió en ${CHALLENGE_TIMEOUT_MS / 1000}s`);
}

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function slugify(url: string): string {
  const u = new URL(url);
  const base = (u.pathname.split("/").pop() ?? "").replace(/\.php$/i, "");
  const rel = `${base}${u.search}`;
  return rel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFilePath(url: string): string {
  return path.join(RAW_DIR, todayStr(), `${slugify(url)}.html`);
}

function openDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS scrape_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      fetched_at TEXT
    );
  `);
  return db;
}

function seedQueue(db: DatabaseSync, opts: CliOptions): void {
  const { weekFilter: filter, tournamentId } = opts;
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM scrape_queue").get() as unknown as {
    n: number;
  };

  const insert = db.prepare(
    "INSERT OR IGNORE INTO scrape_queue (kind, url, file_path) VALUES (?, ?, ?)",
  );
  const rankingIndexUrl = `${BASE_URL}/OT_Rankings.php`;

  if (tournamentId) {
    // Un torneo suelto: la URL ya se conoce entera (el Trn= es la clave), así que no
    // hace falta pasar por ningún índice anual para descubrirla.
    const url = `${BASE_URL}/OT_ViewTournament.php?Trn=${tournamentId}`;
    insert.run("tournament", url, buildFilePath(url));
    console.log(`Torneo suelto Trn=${tournamentId}: sembrada 1 ficha (cola previa: ${n} filas, intacta).`);
    return;
  }

  if (filter) {
    // Filtro por semana(s): solo sembramos los índices anuales de los años implicados
    // (hace falta visitarlos enteros para descubrir qué torneos caen en esa semana —
    // ver docs/estructura.md §1) más el índice de ranking. INSERT OR IGNORE deja
    // intacta cualquier cola previa ya completada.
    const years = yearsInFilter(filter).filter((y) => y >= START_YEAR);
    for (const year of years) {
      const url = `${BASE_URL}/OnlineTournaments.php?Archive=${year}`;
      insert.run("tournament_index", url, buildFilePath(url));
    }
    insert.run("ranking_index", rankingIndexUrl, buildFilePath(rankingIndexUrl));
    console.log(
      `Filtro de semana ${filter.from.year}-${filter.from.week} → ${filter.to.year}-${filter.to.week}: ` +
        `sembrados ${years.length} índice(s) anual(es) [${years.join(", ")}] + 1 de ranking ` +
        `(cola previa: ${n} filas, intacta).`,
    );
    return;
  }

  if (n > 0) {
    console.log(`Cola existente: ${n} filas. Reanudando.`);
    return;
  }

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    const url = `${BASE_URL}/OnlineTournaments.php?Archive=${year}`;
    insert.run("tournament_index", url, buildFilePath(url));
  }
  insert.run("ranking_index", rankingIndexUrl, buildFilePath(rankingIndexUrl));
  console.log(
    `Cola vacía: sembradas ${CURRENT_YEAR - START_YEAR + 1} fichas de índice de torneos ` +
      `+ 1 de ranking.`,
  );
}

function insertChildren(db: DatabaseSync, urls: string[], kind: QueueKind): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO scrape_queue (kind, url, file_path) VALUES (?, ?, ?)",
  );
  for (const url of urls) {
    insert.run(kind, url, buildFilePath(url));
  }
}

function markDone(db: DatabaseSync, id: number): void {
  db.prepare("UPDATE scrape_queue SET status = 'done', fetched_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    id,
  );
}

function markError(db: DatabaseSync, id: number, attempts: number, message: string): void {
  db.prepare(
    "UPDATE scrape_queue SET status = 'error', attempts = ?, last_error = ? WHERE id = ?",
  ).run(attempts + 1, message, id);
}

function nextRow(db: DatabaseSync): QueueRow | undefined {
  return db
    .prepare(
      `SELECT id, kind, url, file_path, status, attempts FROM scrape_queue
       WHERE status = 'pending' OR (status = 'error' AND attempts < ?)
       ORDER BY id LIMIT 1`,
    )
    .get(MAX_ATTEMPTS) as unknown as QueueRow | undefined;
}

function printSummary(db: DatabaseSync): void {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS n FROM scrape_queue GROUP BY status")
    .all() as unknown as { status: string; n: number }[];
  console.log("\nResumen de la cola:");
  for (const r of rows) console.log(`  ${r.status}: ${r.n}`);
}

interface ArchiveTournamentLink {
  url: string;
  isoWeek: number;
}

/**
 * Solo los Trn= del bloque "Archives of Year <año>", nunca de Registration Open / In
 * Progress. La celda `Week N:` solo aparece en la primera fila de cada semana — hay que
 * "arrastrarla" hacia abajo hasta la siguiente (docs/estructura.md §1).
 */
async function extractArchiveTournamentLinks(page: Page): Promise<ArchiveTournamentLink[]> {
  const rowsFound = await page.$$eval(".OtScrollableContainer table.Ot tbody tr", (rows) => {
    let collecting = false;
    let currentWeek = 0;
    const found: { href: string; isoWeek: number }[] = [];
    for (const row of rows) {
      const blockTitle = row.querySelector("td.Title[colspan]");
      if (blockTitle && /Archives of Year/i.test(blockTitle.textContent ?? "")) {
        collecting = true;
        continue;
      }
      if (!collecting) continue;

      const weekCell = row.querySelector("td.Title:not([colspan])");
      const weekMatch = weekCell ? /Week\s+(\d+)/i.exec(weekCell.textContent ?? "") : null;
      if (weekMatch) currentWeek = Number(weekMatch[1]);

      for (const a of Array.from(row.querySelectorAll("a[href]"))) {
        const href = a.getAttribute("href") ?? "";
        if (/OT_ViewTournament\.php/i.test(href)) found.push({ href, isoWeek: currentWeek });
      }
    }
    return found;
  });

  const seen = new Set<string>();
  const unique: ArchiveTournamentLink[] = [];
  for (const { href, isoWeek } of rowsFound) {
    const url = new URL(href, `${BASE_URL}/`).toString();
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push({ url, isoWeek });
  }
  return unique;
}

async function extractRankingWeeks(page: Page): Promise<string[]> {
  const select = page.locator('select[name="Week"]').first();
  if ((await select.count()) === 0) return [];
  return select.evaluate((el: HTMLSelectElement) => Array.from(el.options).map((o) => o.value));
}

async function processRow(page: Page, db: DatabaseSync, row: QueueRow, opts: CliOptions): Promise<void> {
  const { weekFilter: filter, officialOnly } = opts;
  console.log(`\n→ [${row.kind}] ${row.url}`);
  try {
    await page.goto(row.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await waitOutChallenge(page, row.url);

    const html = await page.content();
    await mkdir(path.dirname(row.file_path), { recursive: true });
    await writeFile(row.file_path, html, "utf-8");
    console.log(`  ✓ Guardado ${path.relative(process.cwd(), row.file_path)} (${html.length} bytes)`);

    if (row.kind === "tournament_index") {
      const yearMatch = /Archive=(\d{4})/.exec(row.url);
      const year = yearMatch ? Number(yearMatch[1]) : NaN;
      const found = await extractArchiveTournamentLinks(page);
      const kept = found.filter((t) => weekInFilter({ year, week: t.isoWeek }, filter));
      insertChildren(db, kept.map((t) => t.url), "tournament");
      console.log(
        `  → ${found.length} torneos en "Archives of Year"` +
          (filter ? `, ${kept.length} dentro del filtro de semana` : ""),
      );
      if (found.length === 0) {
        console.log(`  ⚠ 0 torneos — revisar si la estructura de la página cambió`);
      }
    } else if (row.kind === "ranking_index") {
      const weeks = await extractRankingWeeks(page);
      const recentWeeks = weeks
        .filter((w) => Number(w.split("-")[0]) >= START_YEAR)
        .filter((w) => {
          const [y, wk] = w.split("-").map(Number);
          return weekInFilter({ year: y, week: wk }, filter);
        });
      // Race=1 reutiliza el mismo desplegable de semanas que Race=0 — sin confirmar
      // contra una página Race real todavía (ver docs/decisiones.md), así que si el
      // calendario de la Race resulta ser distinto, esto se queda corto y hay que
      // ajustarlo cuando se vea. --official-only se salta Race=1 del todo.
      const officialUrls = recentWeeks.map((w) => `${BASE_URL}/OT_Rankings.php?Week=${w}&Doubles=0&Race=0`);
      const raceUrls = officialOnly
        ? []
        : recentWeeks.map((w) => `${BASE_URL}/OT_Rankings.php?Week=${w}&Doubles=0&Race=1`);
      insertChildren(db, [...officialUrls, ...raceUrls], "ranking");
      console.log(
        `  → ${officialUrls.length} semanas oficiales` +
          (officialOnly ? " (Race omitida por --official-only)" : ` + ${raceUrls.length} semanas Race`) +
          ` (≥${START_YEAR}${filter ? ", dentro del filtro" : ""}) encoladas`,
      );
      if (recentWeeks.length === 0) {
        console.log(`  ⚠ 0 semanas — revisar si la estructura de la página cambió o si el filtro no casa con ninguna`);
      }
    }

    markDone(db, row.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markError(db, row.id, row.attempts, message);
    console.log(`  ✗ Error (intento ${row.attempts + 1}/${MAX_ATTEMPTS}): ${message}`);
  }
}

async function main() {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      `   Uso: npm run backfill -- --week=AAAA-WW | --from=AAAA-WW --to=AAAA-WW [--official-only] | --tournament=<Trn>`,
    );
    process.exitCode = 1;
    return;
  }
  const { weekFilter: filter, officialOnly, tournamentId } = opts;

  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(USER_DATA_DIR, { recursive: true });

  const db = openDb();
  seedQueue(db, opts);

  console.log(`Contexto persistente: ${USER_DATA_DIR}`);
  console.log(`User-Agent: ${USER_AGENT}`);
  console.log(`Cola: ${DB_PATH}`);
  console.log(
    tournamentId
      ? `Torneo suelto: Trn=${tournamentId}`
      : filter
        ? `Filtro de semana: ${filter.from.year}-${filter.from.week} → ${filter.to.year}-${filter.to.week}`
        : `Rango: ${START_YEAR}-${CURRENT_YEAR}`,
  );
  if (officialOnly) console.log(`Solo ranking oficial (Race=0) — Race omitida`);
  console.log("");

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    userAgent: USER_AGENT,
    locale: "es-ES",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  let interrupted = false;
  const onSigint = () => {
    console.log("\n⏸  Interrumpido — termino la fila en curso y cierro limpio...");
    interrupted = true;
  };
  process.on("SIGINT", onSigint);

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    let processed = 0;
    while (!interrupted) {
      const row = nextRow(db);
      if (!row) break;
      await processRow(page, db, row, opts);
      processed++;
      if (!interrupted) await sleep(REQUEST_DELAY_MS);
    }
    console.log(
      `\n${interrupted ? "⏸  Parado" : "✅ Completado"} tras procesar ${processed} páginas en esta sesión.`,
    );
  } finally {
    process.off("SIGINT", onSigint);
    await context.close();
    printSummary(db);
    db.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Error fatal:", err);
  process.exitCode = 1;
});
