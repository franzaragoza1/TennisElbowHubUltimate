/**
 * Backfill 2021-2026 (fase 2, CLAUDE.md sección 5 / 7).
 *
 * Archiva en crudo, sin parsear nada, los índices anuales, los cuadros de torneo y el
 * ranking Singles Entry semanal del Online Tour de Mana Games. Reanudable: el progreso
 * vive en una cola SQLite (data/scrape-queue.sqlite), así que se puede parar (Ctrl+C) y
 * volver a lanzar sin perder trabajo ni repetir páginas ya descargadas.
 *
 * Uso: npm run backfill
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

function seedIfEmpty(db: DatabaseSync): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM scrape_queue").get() as unknown as {
    n: number;
  };
  if (n > 0) {
    console.log(`Cola existente: ${n} filas. Reanudando.`);
    return;
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO scrape_queue (kind, url, file_path) VALUES (?, ?, ?)",
  );
  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    const url = `${BASE_URL}/OnlineTournaments.php?Archive=${year}`;
    insert.run("tournament_index", url, buildFilePath(url));
  }
  const rankingIndexUrl = `${BASE_URL}/OT_Rankings.php`;
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

/** Solo los Trn= del bloque "Archives of Year <año>", nunca de Registration Open / In Progress. */
async function extractArchiveTournamentLinks(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval(".OtScrollableContainer table.Ot tbody tr", (rows) => {
    let collecting = false;
    const links: string[] = [];
    for (const row of rows) {
      const titleCell = row.querySelector("td.Title[colspan]");
      if (titleCell && /Archives of Year/i.test(titleCell.textContent ?? "")) {
        collecting = true;
        continue;
      }
      if (!collecting) continue;
      for (const a of Array.from(row.querySelectorAll("a[href]"))) {
        const href = a.getAttribute("href") ?? "";
        if (/OT_ViewTournament\.php/i.test(href)) links.push(href);
      }
    }
    return links;
  });
  const unique = Array.from(new Set(hrefs));
  return unique.map((href) => new URL(href, `${BASE_URL}/`).toString());
}

async function extractRankingWeeks(page: Page): Promise<string[]> {
  const select = page.locator('select[name="Week"]').first();
  if ((await select.count()) === 0) return [];
  return select.evaluate((el: HTMLSelectElement) => Array.from(el.options).map((o) => o.value));
}

async function processRow(page: Page, db: DatabaseSync, row: QueueRow): Promise<void> {
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
      const links = await extractArchiveTournamentLinks(page);
      insertChildren(db, links, "tournament");
      console.log(`  → ${links.length} torneos encontrados en "Archives of Year"`);
      if (links.length === 0) {
        console.log(`  ⚠ 0 torneos — revisar si la estructura de la página cambió`);
      }
    } else if (row.kind === "ranking_index") {
      const weeks = await extractRankingWeeks(page);
      const urls = weeks
        .filter((w) => Number(w.split("-")[0]) >= START_YEAR)
        .map((w) => `${BASE_URL}/OT_Rankings.php?Week=${w}&Doubles=0&Race=0`);
      insertChildren(db, urls, "ranking");
      console.log(`  → ${urls.length} semanas de ranking (≥${START_YEAR}) encoladas`);
      if (urls.length === 0) {
        console.log(`  ⚠ 0 semanas — revisar si la estructura de la página cambió`);
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
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(USER_DATA_DIR, { recursive: true });

  const db = openDb();
  seedIfEmpty(db);

  console.log(`Contexto persistente: ${USER_DATA_DIR}`);
  console.log(`User-Agent: ${USER_AGENT}`);
  console.log(`Cola: ${DB_PATH}`);
  console.log(`Rango: ${START_YEAR}-${CURRENT_YEAR}\n`);

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
      await processRow(page, db, row);
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
