/**
 * Script de reconocimiento (fase 1, CLAUDE.md sección 5).
 *
 * Visita un puñado de páginas del Online Tour de Mana Games con un Chromium
 * headful de contexto persistente, y vuelca el HTML resultante a
 * data/raw/explore/. No parsea nada: solo archiva para que docs/estructura.md
 * se escriba leyendo esos ficheros del disco.
 *
 * Uso: npm run explore
 */
import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://www.managames.com/Forum";
const USER_AGENT = "TE4TourBot/0.1 (+mailto:thelolosmusica@gmail.com)";
const USER_DATA_DIR = path.resolve(".playwright");
const OUTPUT_DIR = path.resolve("data/raw/explore");
const REQUEST_DELAY_MS = 8_000;
const CHALLENGE_TIMEOUT_MS = 10 * 60_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera a que desaparezca cualquier pantalla de challenge anti-bot antes de seguir. */
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
        `  ⚠ [${label}] Parece que hay un challenge anti-bot en pantalla. ` +
          `Resuélvelo en la ventana de Chromium (un clic suele bastar); ` +
          `el script sigue comprobando solo, no hace falta reiniciarlo.`,
      );
      warned = true;
    }
    await sleep(3_000);
  }
  throw new Error(`[${label}] El challenge no se resolvió en ${CHALLENGE_TIMEOUT_MS / 1000}s`);
}

async function visit(page: Page, url: string, label: string, filename: string): Promise<void> {
  console.log(`\n→ ${label}: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await waitOutChallenge(page, label);
  const html = await page.content();
  const filePath = path.join(OUTPUT_DIR, filename);
  await writeFile(filePath, html, "utf-8");
  console.log(`  ✓ Guardado ${path.relative(process.cwd(), filePath)} (${html.length} bytes)`);
}

/** Extrae, de la página ya cargada, los enlaces a cuadros de torneo. */
async function extractTournamentLinks(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (anchors) =>
    anchors
      .map((a) => a.getAttribute("href") ?? "")
      .filter((href) => /OT_ViewTournament\.php/i.test(href)),
  );
  return Array.from(new Set(hrefs));
}

function pickThreeBrackets(links2021: string[], links2026: string[]): string[] {
  const picks: string[] = [];
  if (links2021.length > 0) picks.push(links2021[Math.floor(links2021.length / 2)]);
  if (links2026.length > 0) picks.push(links2026[0]);
  if (links2026.length > 1) picks.push(links2026[links2026.length - 1]);

  const fallbackPool = [...links2021, ...links2026];
  let i = 0;
  while (picks.length < 3 && i < fallbackPool.length) {
    if (!picks.includes(fallbackPool[i])) picks.push(fallbackPool[i]);
    i++;
  }
  return picks.slice(0, 3);
}

interface WeekOption {
  index: number;
  value: string;
  text: string;
  selected: boolean;
}

interface WeekSelectMeta {
  options: WeekOption[];
  currentIndex: number;
  targetIndex: number;
}

/** Busca el desplegable de semanas en OT_Rankings.php y selecciona una semana antigua. */
async function selectOldWeek(page: Page): Promise<WeekSelectMeta | null> {
  const select = page.locator("select").first();
  if ((await select.count()) === 0) {
    console.log("  ⚠ No se encontró ningún <select> en OT_Rankings.php");
    return null;
  }

  const options = await select.evaluate((el: HTMLSelectElement) =>
    Array.from(el.options).map((o, index) => ({
      index,
      value: o.value,
      text: (o.textContent ?? "").trim(),
      selected: o.selected,
    })),
  );
  const currentIndex = options.findIndex((o) => o.selected);

  let targetIndex = 0;
  let maxDist = -1;
  for (const o of options) {
    const dist = Math.abs(o.index - currentIndex);
    if (dist > maxDist) {
      maxDist = dist;
      targetIndex = o.index;
    }
  }

  console.log(
    `  Semana actual: "${options[currentIndex]?.text}" (índice ${currentIndex}). ` +
      `Eligiendo semana antigua: "${options[targetIndex]?.text}" (índice ${targetIndex})`,
  );

  const before = page.url();
  await select.selectOption({ index: targetIndex });

  const navigated = await page
    .waitForURL((url) => url.toString() !== before, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!navigated) {
    const submit = page.locator("input[type=submit], button[type=submit]").first();
    if ((await submit.count()) > 0) {
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
        submit.click(),
      ]);
    } else {
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    }
  }

  return { options, currentIndex, targetIndex };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(USER_DATA_DIR, { recursive: true });

  console.log(`Contexto persistente: ${USER_DATA_DIR}`);
  console.log(`User-Agent: ${USER_AGENT}`);
  console.log("Si aparece un challenge anti-bot, resuélvelo tú en la ventana visible.\n");

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    userAgent: USER_AGENT,
    locale: "es-ES",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await visit(
      page,
      `${BASE_URL}/OnlineTournaments.php?Archive=2026`,
      "Archivo 2026",
      "archive_2026.html",
    );
    const links2026 = await extractTournamentLinks(page);
    console.log(`  → ${links2026.length} enlaces a cuadros encontrados`);
    await sleep(REQUEST_DELAY_MS);

    await visit(
      page,
      `${BASE_URL}/OnlineTournaments.php?Archive=2021`,
      "Archivo 2021",
      "archive_2021.html",
    );
    const links2021 = await extractTournamentLinks(page);
    console.log(`  → ${links2021.length} enlaces a cuadros encontrados`);
    await sleep(REQUEST_DELAY_MS);

    await visit(page, `${BASE_URL}/OT_Rankings.php`, "Rankings (semana actual)", "rankings_current.html");
    const weekMeta = await selectOldWeek(page);
    await sleep(REQUEST_DELAY_MS);

    const oldWeekHtml = await page.content();
    await writeFile(path.join(OUTPUT_DIR, "rankings_old_week.html"), oldWeekHtml, "utf-8");
    console.log(
      `  ✓ Guardado rankings_old_week.html (${oldWeekHtml.length} bytes), URL resultante: ${page.url()}`,
    );
    if (weekMeta) {
      await writeFile(
        path.join(OUTPUT_DIR, "rankings_week_select.json"),
        JSON.stringify(weekMeta, null, 2),
        "utf-8",
      );
    }
    await sleep(REQUEST_DELAY_MS);

    const chosenBrackets = pickThreeBrackets(links2021, links2026);
    if (chosenBrackets.length < 3) {
      console.log(
        `  ⚠ Solo se encontraron ${chosenBrackets.length} enlaces a cuadros (se esperaban 3). Continúo con los que hay.`,
      );
    }
    for (let i = 0; i < chosenBrackets.length; i++) {
      const absoluteUrl = new URL(chosenBrackets[i], `${BASE_URL}/`).toString();
      await visit(page, absoluteUrl, `Cuadro ${i + 1}/${chosenBrackets.length}`, `bracket_${i + 1}.html`);
      await sleep(REQUEST_DELAY_MS);
    }

    await visit(page, `${BASE_URL}/OT_LastResults.php`, "Últimos resultados", "last_results.html");

    console.log("\n✅ Exploración completa. HTML guardado en data/raw/explore/");
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Error en la exploración:", err);
  process.exitCode = 1;
});
