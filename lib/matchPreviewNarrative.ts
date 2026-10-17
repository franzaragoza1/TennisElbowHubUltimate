import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { matchPreviews } from "@/db/schema";
import { LLM_EXTRA, LLM_MODEL, LLM_URL, llmApiKey } from "@/lib/llm";

// Mismo modelo, mismo motivo, que lib/h2hNarrative.ts/lib/newsGeneration/*.
const MODEL = LLM_MODEL;
const GROQ_URL = LLM_URL; // (nombre histórico: ya no es solo Groq, ver lib/llm.ts)
const MAX_CHARS = 420;
const TIMEOUT_MS = 8000;

export interface MatchPreviewFacts {
  playerA: string;
  playerB: string;
  tournament: string;
  round: string; // ya en prosa, ver lib/bracket.ts::roundDisplayLabel
  surface: string | null;
  rankingA: string; // "#12" o "unranked"
  rankingB: string;
  headToHead: { playerA: number; playerB: number; totalMeetings: number };
  recentFormA: string; // p.ej. "won 4 of the last 5"
  recentFormB: string;
  careerWinPctA: number;
  careerWinPctB: number;
}

/** Igual que lib/h2hNarrative.ts::everyNumberIsBackedByFacts — red de seguridad
 * determinista contra cifras inventadas, reutilizada tal cual. */
function everyNumberIsBackedByFacts(narrative: string, facts: MatchPreviewFacts): boolean {
  const allowed = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number") allowed.add(String(value));
    else if (typeof value === "string") for (const n of value.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(n);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(facts);
  return (narrative.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(n));
}

const SYSTEM_PROMPT = `You write a single short preview paragraph for an upcoming tennis match on an online tour, before it's been played.

The page already shows, right next to your text: both rankings, the head-to-head record, recent form, and career win rate. Repeating all of those flatly is worthless — pick the one or two things that actually make this matchup interesting, and write like a preview, not a stat dump.

Rules:
- Use ONLY the facts in the JSON. Never invent or estimate a number, name, streak, or detail not given.
- The match hasn't been played — never write as if it already happened or hint at a result. This is a preview, not a recap.
- Never invent or imply a favorite, an underdog, or odds of any kind — nothing in the facts measures who's actually likely to win this specific match, so don't write as if something does. A large ranking or record gap is a fact you can mention, not a prediction to make.
- Refer to players by name only. Never use he, she, him, her, his or hers — these are usernames and you do not know who is behind them.
- 2 to 3 sentences, 55 words maximum.
- Neutral sports-desk tone. Plain prose: no headings, no bullets, no markdown, no quotation marks.
- Never mention data, statistics, records, JSON, analysis, probability models, or that you are a model.`;

async function callGroq(facts: MatchPreviewFacts, apiKey: string): Promise<string | null> {
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
        max_tokens: 700, // mismo motivo que lib/h2hNarrative.ts — modelo "de razonamiento", gasta presupuesto en pensar antes del JSON final
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

    const clean = text.trim().replace(/^["']|["']$/g, "");
    if (clean.length === 0 || clean.length > MAX_CHARS) return null;
    if (!everyNumberIsBackedByFacts(clean, facts)) return null;
    return clean;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Párrafo de preview de un cruce `pending`, de caché si sigue vigente (misma
 * estrategia que lib/h2hNarrative.ts::getH2HNarrative). `fingerprint` lo calcula quien
 * llama, a partir de los mismos datos que ya reunió para el resto de la página —
 * cambia en cuanto algo real cambia (nueva semana de ranking, un partido nuevo de
 * cualquiera de los dos, el propio cruce se resuelve) y nunca antes. Nunca lanza: si
 * algo falla, devuelve el último párrafo cacheado (si hay) o null.
 */
export async function getMatchPreviewNarrative(pendingSlotId: number, facts: MatchPreviewFacts, fingerprint: string): Promise<string | null> {
  const apiKey = llmApiKey();
  if (!apiKey) return null;

  try {
    const [cached] = await db
      .select({ narrative: matchPreviews.narrative, fingerprint: matchPreviews.fingerprint })
      .from(matchPreviews)
      .where(eq(matchPreviews.pendingSlotId, pendingSlotId));
    if (cached && cached.fingerprint === fingerprint) return cached.narrative;

    const narrative = await callGroq(facts, apiKey);
    if (!narrative) return cached?.narrative ?? null;

    await db
      .insert(matchPreviews)
      .values({ pendingSlotId, fingerprint, narrative, model: MODEL })
      .onConflictDoUpdate({ target: matchPreviews.pendingSlotId, set: { fingerprint, narrative, model: MODEL, createdAt: sql`now()` } });

    return narrative;
  } catch {
    return null;
  }
}
