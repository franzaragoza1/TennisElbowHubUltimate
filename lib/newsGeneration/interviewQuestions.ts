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

export interface InterviewContext {
  playerName: string;
  opponentName: string;
  scoreRaw: string | null;
  roundLabel: string; // ya traducido ("Final", "Semifinal"...), ver lib/bracket.ts
  eventName: string;
  playerWon: boolean;
}

export interface InterviewQA {
  question: string;
  answer: string;
}

const SYSTEM_PROMPT = `You are a tennis journalist conducting a short post-match interview with a player on an online tennis tour, right after their match.
Rules:
- Use ONLY the facts given (the match context, and the conversation so far). Never invent a score, ranking, or detail not given.
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
        max_tokens: 150,
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
