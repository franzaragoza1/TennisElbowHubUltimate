import type { RelatedInterviewQuote } from "./relatedInterviews";

/**
 * Reemplaza al viejo "Generate AI drafts" (cinco detectores que escaneaban la base de
 * datos y escribían el artículo entero solos) — pedido explícito del propietario,
 * 2026-09-15: un admin decide TODO lo que el artículo trata (titular, torneo,
 * jugadores etiquetados, y un primer borrador del cuerpo, aunque sean solo notas
 * sueltas) desde el formulario normal; esto solo PULE ese contenido ya decidido —
 * mejor gramática y prosa — y, si hay entrevistas reales de esos jugadores en ese
 * mismo torneo, teje 1-2 citas suyas de verdad, nunca inventadas.
 */
const MODEL = "openai/gpt-oss-120b"; // ver lib/newsGeneration/draft.ts — mismo modelo, mismo motivo
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;
const MAX_EXCERPT_CHARS = 200;
const MAX_BODY_CHARS = 1500; // más margen que draft.ts: un admin puede escribir un borrador ya largo

export interface EnhanceNewsInput {
  title: string;
  category: string;
  tournamentLabel: string | null;
  taggedPlayerNames: string[];
  /** Texto plano — lo que el admin ya escribió, aunque sean solo notas sueltas. Nunca
   * vacío: sin nada que pulir, no hay nada que esta función pueda hacer de verdad. */
  draftBody: string;
  relatedQuotes: RelatedInterviewQuote[];
}

export interface EnhancedNewsContent {
  excerpt: string;
  body: string;
}

/** Misma red de seguridad que lib/newsGeneration/draft.ts: toda cifra que aparezca en
 * el texto generado tiene que existir ya en lo que el admin escribió o en las citas
 * reales — nunca una que el modelo se invente al "enriquecer" la prosa. */
function everyNumberIsBackedByInput(text: string, input: EnhanceNewsInput): boolean {
  const allowed = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number") allowed.add(String(value));
    else if (typeof value === "string") for (const n of value.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(n);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(input.title);
  collect(input.draftBody);
  collect(input.relatedQuotes);
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(n));
}

const SYSTEM_PROMPT = `You are a copy editor for an online tennis tour's news page. An admin has already decided everything about this story — its headline, its topic, which players and tournament it's about — and written a rough draft of the body (it may be nothing more than a few loose notes). Your job is ONLY to:
1. Rewrite that draft into clean, well-structured sports-desk prose — better grammar, better flow — without changing the facts, adding new ones, or dropping real ones already there.
2. If real post-match interview quotes are given, weave 1-2 of the most relevant ones in naturally, in reported style (never literal quotation marks). Never invent a quote, and never use a quote that isn't given.
3. Write a one-sentence "excerpt" summarizing the story.

Rules:
- Never invent or estimate a number, name, year, tournament, round, or score that isn't already in the admin's own draft, the headline, or the given quotes.
- Never use he, she, him, her, his, hers for players — these are usernames on an online tour, not real identities.
- Plain prose, no markdown, no headings, no quotation marks, no emoji.
- Never mention that you are a model, or that this text was AI-assisted.
- Respond with ONLY a JSON object shaped exactly like {"excerpt": string, "body": string}. No other text.
- "excerpt": one sentence, under 200 characters.
- "body": paragraphs separated by a blank line, under 1500 characters total. Keep roughly the admin's own length and level of detail — expand loose notes into full paragraphs, but don't pad an already-full draft.`;

async function callGroq(input: EnhanceNewsInput, apiKey: string): Promise<EnhancedNewsContent | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              title: input.title,
              category: input.category,
              tournament: input.tournamentLabel,
              taggedPlayers: input.taggedPlayerNames,
              draftBody: input.draftBody,
              relatedQuotes: input.relatedQuotes,
            }),
          },
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
    const { excerpt, body } = (parsed ?? {}) as { excerpt?: unknown; body?: unknown };
    if (typeof excerpt !== "string" || typeof body !== "string") return null;
    if (excerpt.length === 0 || excerpt.length > MAX_EXCERPT_CHARS) return null;
    if (body.length === 0 || body.length > MAX_BODY_CHARS) return null;
    if (!everyNumberIsBackedByInput(`${excerpt} ${body}`, input)) return null;

    return { excerpt, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nunca lanza: sin `GROQ_API_KEY`, con timeout, o con una respuesta ilegible/con una
 * cifra inventada, devuelve null — el admin se queda con su propio borrador tal cual,
 * nunca con un campo a medias. */
export async function enhanceNewsContent(input: EnhanceNewsInput): Promise<EnhancedNewsContent | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!input.draftBody.trim()) return null;

  return callGroq(input, apiKey);
}
