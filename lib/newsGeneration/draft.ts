import type { NewsCategory } from "@/lib/newsCategories";
import type { NewsFactCandidate } from "./facts";

const MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;
const MAX_TITLE_CHARS = 90;
const MAX_EXCERPT_CHARS = 200;
const MAX_BODY_CHARS = 900;

export interface NewsDraft {
  title: string;
  excerpt: string;
  body: string;
  category: NewsCategory;
  editionId: number | null;
  taggedPlayerIds: number[];
}

/** Misma red de seguridad que lib/h2hNarrative.ts: toda cifra que aparezca en el texto
 * generado tiene que existir ya en los hechos que le pasamos al modelo. */
function everyNumberIsBackedByFacts(text: string, facts: unknown): boolean {
  const allowed = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number") allowed.add(String(value));
    else if (typeof value === "string") for (const n of value.match(/\d+/g) ?? []) allowed.add(n);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(facts);
  return (text.match(/\d+/g) ?? []).every((n) => allowed.has(n));
}

const BASE_RULES = `
Rules:
- Use ONLY the facts in the JSON. Never invent or estimate a number, name, year, tournament, round or score. Every figure you write must appear in the JSON.
- Refer to players by the exact username given. Never use he, she, him, her, his or hers — these are usernames on an online tour, not real identities, and you do not know who is behind them.
- Neutral sports-desk tone. Plain prose, no markdown, no headings, no quotation marks, no emoji.
- Never mention data, statistics, JSON, analysis, or that you are a model.
- Respond with ONLY a JSON object shaped exactly like {"title": string, "excerpt": string, "body": string}. No other text.
- "title": a short headline, under 90 characters.
- "excerpt": one sentence summarizing the story, under 200 characters.
- "body": 2 to 4 short paragraphs (separate paragraphs with a blank line), under 900 characters total.`;

const SYSTEM_PROMPTS: Record<NewsFactCandidate["kind"], string> = {
  champion_crowned: `You write a short news report about a champion being crowned on an online tennis tour, for the tour's own news page.
Cover: who won, who they beat in the final, the score, and the tournament/category. If it's their maiden title or a big category (GS/M1000/Tour Finals), that's worth leading with.${BASE_RULES}`,
  title_milestone: `You write a short news feature about a career milestone: a player's Nth title, or their very first ever. Frame it as a career-arc story, not a match report — the tournament win is the occasion, the milestone is the headline.${BASE_RULES}`,
  upset: `You write a short news report about an upset result on an online tennis tour: a lower-ranked player beating a much higher-ranked one. Lead with the score and both rankings. If you state the size of the ranking gap, use ONLY the "rankGap" figure already given — never compute your own by subtracting the two ranks.${BASE_RULES}`,
  win_streak: `You write a short news feature about a player on a current winning streak across multiple tournaments. List a couple of the opponents beaten if it helps the story, but don't just list all of them.${BASE_RULES}`,
  ranking_milestone: `You write a short news report about a ranking milestone: a player reaching World No.1 for the first time, breaking into the Top 10 for the first time, or hitting a new career-high ranking. Say what their previous best was, if there was one.${BASE_RULES}`,
};

const CATEGORY_BY_KIND: Record<NewsFactCandidate["kind"], NewsCategory> = {
  champion_crowned: "RESULTS",
  title_milestone: "FEATURE",
  upset: "RESULTS",
  win_streak: "REPORT",
  ranking_milestone: "FEATURE",
};

function editionIdOf(facts: NewsFactCandidate): number | null {
  if (facts.kind === "champion_crowned" || facts.kind === "title_milestone") return facts.editionId;
  return null;
}

function taggedPlayerIdsOf(facts: NewsFactCandidate): number[] {
  switch (facts.kind) {
    case "champion_crowned":
      return [facts.championId, facts.runnerUpId];
    case "title_milestone":
      return [facts.championId];
    case "upset":
      return [facts.winnerId, facts.loserId];
    case "win_streak":
      return [facts.playerId];
    case "ranking_milestone":
      return [facts.playerId];
  }
}

async function callGroq(facts: NewsFactCandidate, apiKey: string): Promise<{ title: string; excerpt: string; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[facts.kind] },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const text = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const { title, excerpt, body } = (parsed ?? {}) as { title?: unknown; excerpt?: unknown; body?: unknown };
    if (typeof title !== "string" || typeof excerpt !== "string" || typeof body !== "string") return null;
    if (title.length === 0 || title.length > MAX_TITLE_CHARS) return null;
    if (excerpt.length === 0 || excerpt.length > MAX_EXCERPT_CHARS) return null;
    if (body.length === 0 || body.length > MAX_BODY_CHARS) return null;
    if (!everyNumberIsBackedByFacts(`${title} ${excerpt} ${body}`, facts)) return null;

    return { title, excerpt, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nunca lanza: si algo falla (timeout, respuesta ilegible, cifra inventada), devuelve
 * null y ese candidato simplemente no genera borrador — igual que lib/h2hNarrative.ts. */
export async function draftNewsStory(facts: NewsFactCandidate): Promise<NewsDraft | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const written = await callGroq(facts, apiKey);
  if (!written) return null;

  return {
    title: written.title,
    excerpt: written.excerpt,
    body: written.body,
    category: CATEGORY_BY_KIND[facts.kind],
    editionId: editionIdOf(facts),
    taggedPlayerIds: taggedPlayerIdsOf(facts),
  };
}
