import type { RelatedInterviewQuote } from "./relatedInterviews";
import type { RelatedNewsItem } from "./relatedNews";
import { LLM_EXTRA, LLM_MODEL, LLM_URL, llmApiKey } from "@/lib/llm";

/**
 * Reemplaza al viejo "Generate AI drafts" (cinco detectores que escaneaban la base de
 * datos y escribían el artículo entero solos) — pedido explícito del propietario,
 * 2026-09-15: un admin (o un reportero aprobado) decide TODO lo que el artículo trata
 * (titular, torneo, jugadores etiquetados, y un primer borrador del cuerpo, aunque
 * sean solo notas sueltas) desde el formulario normal; esto PULE ese contenido ya
 * decidido y lo ENRIQUECE con hechos reales que ya existen en el sitio — cobertura
 * previa, forma reciente, ranking actual, entrevistas reales — nunca inventa ninguno.
 * Si el propio borrador deja una pregunta suelta ("¿cuál fue el marcador del H2H
 * anterior?"), la responde SOLO si la respuesta está de verdad en alguno de estos
 * hechos; si no, la deja tal cual en vez de adivinar.
 */
const MODEL = LLM_MODEL;
const GROQ_URL = LLM_URL; // (nombre histórico: ya no es solo Groq, ver lib/llm.ts)
const TIMEOUT_MS = 8000;
const MAX_EXCERPT_CHARS = 200;
const MAX_BODY_CHARS = 1800; // más margen que antes: ahora puede tejer más hechos reales, no solo pulir

export interface PlayerContext {
  playerName: string;
  currentRank: number | null;
  /** Del más reciente al más antiguo, mismo formato que lib/newsGeneration/
   * recentForm.ts::getRecentFormLines ("W vs Name 6-4 7-5 — F Miami"). */
  recentForm: string[];
}

export interface EnhanceNewsInput {
  title: string;
  category: string;
  tournamentLabel: string | null;
  taggedPlayerNames: string[];
  /** Texto plano — lo que el admin/reportero ya escribió, aunque sean solo notas
   * sueltas o una pregunta pendiente de responder. Nunca vacío: sin nada que pulir,
   * no hay nada que esta función pueda hacer de verdad. */
  draftBody: string;
  relatedQuotes: RelatedInterviewQuote[];
  relatedNews: RelatedNewsItem[];
  playerContext: PlayerContext[];
}

export interface EnhancedNewsContent {
  excerpt: string;
  body: string;
}

/** Misma red de seguridad que lib/newsGeneration/draft.ts: toda cifra que aparezca en
 * el texto generado tiene que existir ya en algo que YA es real (el propio borrador, o
 * cualquiera de los hechos que se le dieron) — nunca una que el modelo se invente al
 * enriquecer la prosa o "responder" una pregunta suelta. */
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
  collect(input.relatedNews);
  collect(input.playerContext);
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(n));
}

const SYSTEM_PROMPT = `You are an experienced sports writer for an online tennis tour's news page — you've covered this tour for years, you know its players and rivalries, and you write like a real journalist, not a press-release generator or a wire-service ticker. An admin or approved reporter has already decided everything about this story — its headline, its topic, which players and tournament it's about — and written a rough draft of the body (it may be nothing more than a few loose notes, or a question they haven't answered yet). Your job is to:

1. Rewrite that draft into genuinely good, natural sports-desk prose — vary your sentence length and structure, don't fall into a "PlayerName did X. PlayerName also did Y." rhythm for every sentence, and let a little real personality and voice through. It should read like a person wrote it, not a template.
2. Enrich it with real, relevant facts already given below — recent form, current ranking, past coverage of this player or tournament, a real interview quote — wherever they genuinely add something. Don't force in a fact that doesn't fit.
3. If the draft leaves a question unanswered (a note to self, something in brackets, a literal question), answer it ONLY if the answer is actually present in the facts given below. If it isn't, leave that part alone rather than guessing or writing around it awkwardly.
4. If real post-match interview quotes are given, weave in 1-2 of the most relevant ones naturally, in reported style (never literal quotation marks). Never invent a quote, and never use one that isn't given.
5. Write a one-sentence "excerpt" summarizing the story.

Rules:
- Never invent or estimate a number, name, year, tournament, round, or score that isn't already in the admin's own draft, the headline, or one of the facts given below (recent form, ranking, past coverage, quotes).
- Never use he, she, him, her, his, hers for players — these are usernames on an online tour, not real identities. Vary between the full username and natural sentence restructuring instead of starting every sentence with it.
- Plain prose, no markdown, no headings, no quotation marks, no emoji.
- Never mention that you are a model, or that this text was AI-assisted.
- Respond with ONLY a JSON object shaped exactly like {"excerpt": string, "body": string}. No other text.
- "excerpt": one sentence, under 200 characters.
- "body": paragraphs separated by a blank line, under 1800 characters total.`;

async function callGroq(input: EnhanceNewsInput, apiKey: string): Promise<EnhancedNewsContent | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        ...LLM_EXTRA,
        temperature: 0.6,
        max_tokens: 1000,
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
              relatedPastCoverage: input.relatedNews,
              playerContext: input.playerContext,
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
 * cifra inventada, devuelve null — quien llame se queda con su propio borrador tal
 * cual, nunca con un campo a medias. */
export async function enhanceNewsContent(input: EnhanceNewsInput): Promise<EnhancedNewsContent | null> {
  const apiKey = llmApiKey();
  if (!apiKey) return null;
  if (!input.draftBody.trim()) return null;

  return callGroq(input, apiKey);
}
