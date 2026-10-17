import type { PostMatchInterviewCandidate } from "./facts";
import { LLM_EXTRA, LLM_MODEL, LLM_URL, llmApiKey } from "@/lib/llm";

// Desapareció del catálogo de Groq (comprobado: ya no aparece en GET
// /openai/v1/models con esta clave, devuelve 404 "model_not_found" en cualquier
// llamada) — descubierto 2026-09-05 mientras se depuraba lib/matchLog/suggestNameMatches.ts,
// que usa el mismo proveedor. openai/gpt-oss-120b es, de los modelos de chat de
// propósito general que SÍ siguen listados, el más grande disponible.
const MODEL = LLM_MODEL;
const GROQ_URL = LLM_URL; // (nombre histórico: ya no es solo Groq, ver lib/llm.ts)
const TIMEOUT_MS = 8000;
const MAX_TITLE_CHARS = 90;
const MAX_EXCERPT_CHARS = 200;
const MAX_BODY_CHARS = 900;

export interface NewsDraft {
  title: string;
  excerpt: string;
  body: string;
  category: "FEATURE";
  editionId: number;
  taggedPlayerIds: number[];
}

/** Misma red de seguridad que lib/h2hNarrative.ts: toda cifra que aparezca en el texto
 * generado tiene que existir ya en los hechos que le pasamos al modelo. */
function everyNumberIsBackedByFacts(text: string, facts: unknown): boolean {
  const allowed = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number") allowed.add(String(value));
    else if (typeof value === "string") for (const n of value.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(n);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(facts);
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(n));
}

const BASE_RULES = `
Rules:
- Use ONLY the facts in the JSON. Never invent or estimate a number, name, year, tournament, round or score. Every figure you write must appear in the JSON.
- Refer to players by the exact username given. Never use he, she, him, her, his or hers — these are usernames on an online tour, not real identities, and you do not know who is behind them. Vary your sentence structure instead of starting every sentence with the username.
- Write like a real sports journalist, not a template or a wire-service ticker — vary sentence length, avoid a "PlayerName did X. PlayerName also did Y." rhythm, let a little natural voice through. Plain prose, no markdown, no headings, no quotation marks, no emoji.
- Never mention data, statistics, JSON, analysis, or that you are a model.
- Respond with ONLY a JSON object shaped exactly like {"title": string, "excerpt": string, "body": string}. No other text.
- "title": a short headline, under 90 characters.
- "excerpt": one sentence summarizing the story, under 200 characters.
- "body": 2 to 4 short paragraphs (separate paragraphs with a blank line), under 900 characters total.`;

const SYSTEM_PROMPT = `You are an experienced sports journalist writing a short news feature built around a player's own post-match interview answers on an online tennis tour. The "qa" array is their real answers to a short interview right after the match — make that the heart of the story, reflecting what they actually said (in reported style, no literal quotation marks — the house style below already forbids them). Mention the score, round, tournament, and opponent. Frame it as their reaction to the result: as a winner's reaction if "playerWon" is true, as their own take on the loss if false.${BASE_RULES}`;

async function callGroq(facts: PostMatchInterviewCandidate, apiKey: string): Promise<{ title: string; excerpt: string; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        ...LLM_EXTRA,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
export async function draftNewsStory(facts: PostMatchInterviewCandidate): Promise<NewsDraft | null> {
  const apiKey = llmApiKey();
  if (!apiKey) return null;

  const written = await callGroq(facts, apiKey);
  if (!written) return null;

  return {
    title: written.title,
    excerpt: written.excerpt,
    body: written.body,
    category: "FEATURE",
    editionId: facts.editionId,
    taggedPlayerIds: [facts.playerId, facts.opponentId],
  };
}
