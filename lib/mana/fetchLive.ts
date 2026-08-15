/**
 * Ir a buscar UNA página de Mana Games en vivo, para los botones del panel de admin
 * ("Add tournament", "Refresh scores") — a diferencia de `scripts/backfill.ts` (cola
 * completa, pensada para correr desatendida un buen rato), esto es una sola petición
 * bajo demanda.
 *
 * Mismo contexto persistente (`.playwright/`) que el resto del scraper — la cookie del
 * challenge anti-bot, una vez resuelta a mano, se reutiliza aquí también (CLAUDE.md
 * §5). Solo funciona donde haya un Chromium instalado y pantalla para resolver el
 * challenge si reaparece (aviso 8 de docs/estructura.md): un servidor de admin local
 * (`npm run dev`), no una función serverless de Vercel — `playwright` vive a propósito
 * en devDependencies, nunca se pensó para desplegarse.
 */
import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://www.managames.com/Forum";
const USER_AGENT = "TE4TourBot/0.1 (+mailto:thelolosmusica@gmail.com)";
const USER_DATA_DIR = path.resolve(".playwright");
const RAW_DIR = path.resolve("data/raw/mana");
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

/** Duplicado deliberadamente de scripts/backfill.ts (ya aprobado, no se toca). */
async function waitOutChallenge(page: Page, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < CHALLENGE_TIMEOUT_MS) {
    const resolved = await page.evaluate((markers) => {
      const text = (document.body?.innerText ?? "").toLowerCase();
      const looksLikeChallenge = markers.some((m) => text.includes(m));
      return document.readyState === "complete" && !looksLikeChallenge && text.length > 500;
    }, CHALLENGE_MARKERS);
    if (resolved) return;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`[${label}] El challenge no se resolvió en ${CHALLENGE_TIMEOUT_MS / 1000}s`);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface LiveFetch {
  html: string;
  url: string;
}

/** La pieza compartida de verdad: lanzar el contexto, ir a `url`, esperar el
 * challenge si aparece, archivar el HTML tal cual (fuente de verdad local, CLAUDE.md
 * §5) y devolverlo. `fetchTournamentPageLive`/`fetchLastResultsPageLive` son solo
 * esto con la URL y el nombre de fichero ya resueltos. */
async function fetchManaPageLive(url: string, archiveFileName: string): Promise<LiveFetch> {
  await mkdir(USER_DATA_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    userAgent: USER_AGENT,
    locale: "es-ES",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await waitOutChallenge(page, url);

    const html = await page.content();

    const filePath = path.join(RAW_DIR, todayStr(), archiveFileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, html, "utf-8");

    return { html, url };
  } finally {
    await context.close();
  }
}

/** Trae `OT_ViewTournament.php?Trn=<externalId>` tal cual está ahora mismo — sirve
 * igual para un torneo que aún no existe en la base de datos (se crea) como para uno ya
 * importado que ha avanzado desde la última vez (se reemplazan sus partidos). */
export async function fetchTournamentPageLive(externalId: string): Promise<LiveFetch> {
  return fetchManaPageLive(
    `${BASE_URL}/OT_ViewTournament.php?Trn=${externalId}`,
    `ot-viewtournament-trn-${externalId}.html`,
  );
}

/** Trae `OT_LastResults.php` tal cual está ahora mismo — el "ticker" de resultados
 * recién reportados que alimenta `/scores`. */
export async function fetchLastResultsPageLive(): Promise<LiveFetch> {
  return fetchManaPageLive(`${BASE_URL}/OT_LastResults.php`, `ot-lastresults-${Date.now()}.html`);
}
