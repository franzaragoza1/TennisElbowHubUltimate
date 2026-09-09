/**
 * Preguntas de la mini-entrevista tras un partido que hace el bot de Discord (máx. 3,
 * ver `lib/discordBot/interactions/interviewMessage.ts`) — mismo patrón Groq/JSON/
 * "nunca lanza, cae a null" que `lib/newsGeneration/draft.ts`. El límite de 3 lo
 * cuenta el propio bot en código, nunca se le confía al modelo contarlas solo.
 */
const MODEL = "openai/gpt-oss-120b"; // ver lib/newsGeneration/draft.ts — mismo modelo, mismo motivo (llama-3.3-70b-versatile desapareció del catálogo de Groq)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;
const MAX_QUESTION_CHARS = 200;
// `gpt-oss-120b` es un modelo "de razonamiento": gasta parte del presupuesto de tokens
// pensando en un campo `reasoning` aparte ANTES de escribir el `content` final. Con
// 150 (el límite que había antes) el razonamiento se comía el presupuesto entero y no
// quedaba nada para el JSON de verdad — Groq devolvía 400 "json_validate_failed" con
// `failed_generation` vacío, `callGroq` lo trataba como fallo y caía a `null` en
// SILENCIO. Bug real reportado en producción: el hilo se abría con la pregunta
// genérica de fallback de interviewButton.ts en vez de una pregunta real, y
// interviewMessage.ts se quedaba sin `pendingQuestion` con el que emparejar la
// respuesta — la entrevista moría después de la primera respuesta, siempre. Probado en
// vivo contra la API real: 150 falla siempre, 600 nunca.
const MAX_TOKENS = 600;

export interface InterviewContext {
  playerName: string;
  opponentName: string;
  /** Rank oficial vigente (lib/tourQueries.ts::getCurrentRanks) — null si el jugador
   * no tiene ranking publicado todavía (debut reciente, sin snapshot de esta semana). */
  playerRank: number | null;
  opponentRank: number | null;
  scoreRaw: string | null;
  roundLabel: string; // ya traducido ("Final", "Semifinal"...), ver lib/bracket.ts
  eventName: string;
  tournamentCategory: string; // "GS" | "M1000" | "500" | "250" | "finals" — texto libre, ver editions.category
  tournamentSurface: string | null; // null en las Tour Finals (sin pista real), ver editions.surface
  playerWon: boolean;
  /** Últimos partidos de cada jugador ANTES de este, más reciente primero — ver
   * lib/newsGeneration/recentForm.ts. Vacío si no hay historial (debut). */
  playerRecentForm: string[];
  opponentRecentForm: string[];
}

export interface InterviewQA {
  question: string;
  answer: string;
}

const SYSTEM_PROMPT = `You are a tennis journalist who has covered this online tour for years, conducting a short post-match interview with a player right after their match. You know the tour, you have a dry sense of humor, and you're genuinely curious — not reading off a script.
Rules:
- Use ONLY the facts given (the match context, both players' rankings, the tournament's category and surface, each player's recent form, and the conversation so far). Never invent a score, ranking, streak, or detail not given.
- Ground the question in something specific and real: the score line, a swing in the match (e.g. a lost set before winning, a tight tiebreak), a ranking gap or upset, what the tournament's category or surface means for this result, or a genuine pattern in the recent-form lists (a win/loss streak, a repeat opponent, a string of tight matches). Don't ask something so generic it could apply to any match.
- Let a little personality show — a dry aside or a pointed observation is fine — but never at the player's expense, and never so much it upstages the question itself.
- Ask exactly ONE natural, conversational follow-up question. If there's prior conversation, build on their last answer instead of repeating ground already covered — this is a real back-and-forth, not a fixed script.
- Keep it short: one sentence, no preamble, no "great question" filler, no greeting.
- Never mention that you are a model, an AI, or that this is automated.
- Respond with ONLY a JSON object shaped exactly like {"question": string}. No other text.`;

async function callGroq(context: InterviewContext, priorQA: InterviewQA[], apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ context, priorQA }) },
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
    const { question } = (parsed ?? {}) as { question?: unknown };
    if (typeof question !== "string" || question.length === 0 || question.length > MAX_QUESTION_CHARS) return null;
    return question;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nunca lanza: sin `GROQ_API_KEY`, con timeout, o con una respuesta ilegible, cae a
 * `null` — el bot simplemente no manda la siguiente pregunta (el hilo sigue abierto
 * igual, la gente puede seguir hablando libremente). */
export async function generateNextInterviewQuestion(
  context: InterviewContext,
  priorQA: InterviewQA[],
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return callGroq(context, priorQA, apiKey);
}
