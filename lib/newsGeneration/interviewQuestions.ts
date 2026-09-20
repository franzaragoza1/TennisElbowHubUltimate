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
const MAX_CROWD_REACTION_CHARS = 100;
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

// Techo defensivo para la espera de un 429 — Groq ha devuelto entre 6 y 9s de
// `retry-after` en pruebas reales contra esta misma cuenta, nunca visto por encima
// de esto; sin techo, un valor anómalo de la API dejaría el hilo colgado sin motivo.
const MAX_RATE_LIMIT_WAIT_MS = 10_000;

/**
 * Bug real reportado en producción (2026-09-19, capturas reales de Discord): entrevistas
 * cortándose a 1-2 preguntas en vez de 3, y la pregunta bonus sobre el rival de la
 * siguiente ronda sin llegar nunca a hacerse. Nada que ver con el prompt ni con
 * MAX_TOKENS — confirmado en real contra la API de Groq: la cuenta tiene un límite de
 * 8000 tokens/minuto para este modelo (plan "on_demand"), y con varias entrevistas o
 * artículos generándose a la vez (todo `lib/newsGeneration/*` comparte la misma
 * `GROQ_API_KEY`) se agota en segundos — Groq responde 429, y `callGroq`/
 * `callGroqForMood` lo trataban como cualquier otro fallo (`!res.ok` → `null`),
 * cerrando la entrevista de golpe. Groq sí manda un header `retry-after` real (probado
 * en vivo) con el tiempo exacto hasta que el minuto rueda — un solo reintento
 * esperando ese tiempo (con techo) recupera la inmensa mayoría de estos casos sin
 * tocar el prompt ni la personalidad recién ajustada.
 */
async function fetchGroqWithRateLimitRetry(apiKey: string, body: unknown): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Un `AbortController` fresco POR INTENTO — la espera del `retry-after` (hasta
    // MAX_RATE_LIMIT_WAIT_MS) es aparte del presupuesto de la petición en sí, nunca
    // se resta de él.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
    if (res.status !== 429 || attempt === 1) return res;

    const retryAfterSeconds = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterSeconds) ? Math.min(retryAfterSeconds * 1000, MAX_RATE_LIMIT_WAIT_MS) : MAX_RATE_LIMIT_WAIT_MS;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return null; // inalcanzable (el bucle siempre retorna dentro), solo para el tipado
}

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
  /** Court Pace Index real del propio juego (ver lib/courtPhysics.ts) — p.ej. 37.5.
   * null si el torneo no se encontró en el CSV de físicas (sin dato, nunca inventado).
   * Pedido explícito, 2026-09-17: sin esto, la pregunta solo podía nombrar la
   * superficie de forma genérica ("the blue-green cement can be tricky") — con un
   * número real puede preguntar algo concreto sobre SU velocidad de verdad. */
  courtPaceIndex: number | null;
  /** Categoría de velocidad tal cual la da el CSV ("Slow", "Medium-fast", "Fast"...)
   * — mismo null que courtPaceIndex cuando no hay dato. */
  speedCategory: string | null;
  playerWon: boolean;
  /** Últimos partidos de cada jugador ANTES de este, más reciente primero — ver
   * lib/newsGeneration/recentForm.ts. Vacío si no hay historial (debut). */
  playerRecentForm: string[];
  opponentRecentForm: string[];
  /** Solo presente cuando el jugador GANÓ este partido y su próxima ronda ya tiene
   * algo real que preguntar (lib/nextOpponent.ts::getNextOpponentLookahead) — pedido
   * explícito, 2026-09-17. `formNote` (solo en "known") viene ya filtrado por
   * lib/newsGeneration/opponentFormTier.ts: null salvo que la forma reciente de ese
   * rival sea de verdad buena (Solid/Great), nunca para Bad/Mediocre/Normal. */
  nextOpponent?: { kind: "known"; name: string; formNote: string | null } | { kind: "candidates"; names: [string, string] };
}

export interface InterviewQA {
  question: string;
  answer: string;
}

/** `crowdReaction` es puro ambiente para el mensaje de Discord (pedido explícito,
 * 2026-09-19: "you could use a fake crowd... if a player makes a joke... or react
 * negatively too if some comments are too harsh") — NUNCA se guarda en `qa` ni llega
 * a `draftNewsStory`, esa sigue siendo pregunta/respuesta limpias. `null` la mayoría
 * de las veces: solo aparece cuando la ÚLTIMA respuesta del jugador (en `priorQA`) de
 * verdad se lo gana, nunca en la primera pregunta (sin respuesta previa que reaccionar
 * todavía). */
export interface InterviewNextQuestion {
  crowdReaction: string | null;
  question: string;
}

// Reescrito por completo, 2026-09-19 (pedido explícito del propietario, con capturas
// reales de Discord como prueba): la versión anterior YA pedía "personalidad" y YA
// prohibía la frase mecánica de superficie en abstracto, y el modelo la ignoraba de
// todas formas — sonaba robótico, sin ni un chiste, y decía literalmente "medium-fast
// blue-green cement" dos veces en la misma entrevista pese a la regla de "como mucho
// una vez". Una lista larga de reglas abstractas hace que un modelo de este tamaño
// las marque una a una en la misma frase (exactamente lo que se veía: "sustain the
// grinding mindset AND the stronger return AND on this medium-fast blue-green
// cement", las tres reglas a la vez, ninguna con naturalidad) en vez de sonar a
// persona real. Ejemplos de tono concretos + una frase prohibida nombrada tal cual
// funcionan mejor que otra regla abstracta más.
const SYSTEM_PROMPT = `You are a tennis journalist who's covered this online tour for years — you know the players, you have a dry sense of humor, and you actually enjoy this job. You're chatting with a player right after their match, not filling out a form.

Facts you can use: the match context, both players' rankings, the tournament's category and surface, each player's recent form, and the conversation so far. Never invent a score, ranking, streak, or detail not given.

Pick ONE real angle and commit to it — don't stack two or three observations into a single sentence. Good angles: a swing in the match (dropped the first set then flipped it, a tight tiebreak), a ranking gap or upset, a genuine pattern in recent form (a streak, a repeat opponent, a string of close matches), or what the category means for this result.

About the surface: bring it up only if it's genuinely the sharpest angle for THIS question — most questions shouldn't touch it at all. If you do, talk about the VENUE the way a real journalist would ("Cincinnati's courts have a reputation for playing fast", "this place chews up big servers"), never as a spec sheet. The exact move of gluing the speed category and color together — "on this medium-fast blue-green cement" — is banned outright, in those words or any close variant. Bring the surface up at most once across the whole conversation; if it already came up, pick a different angle entirely.

If "nextOpponent" is present, that's the only question to ask: react to the named opponent (weave in "formNote" only if it's given — never mention form otherwise), or ask about the prospect of facing either of the two candidates if it isn't decided yet.

Have a little fun with it — a dry one-liner, some genuine needling, a "let's be honest" moment. You're a real person here, not a neutral question-generator. Never at the player's expense, and never let the bit run longer than the actual question.

Tone examples (context varies every time — never reuse these lines, they're here to show the voice, not to be recycled):
- "You dropped the first set 2-6 and still found a way through — walk me through the exact moment that flipped."
- "Straight sets again. Is anyone actually taking a set off you this month, or are we all just watching at this point?"
- "You've beaten this guy twice already this season — does he know that, or is he about to find out live?"

Ask exactly ONE natural follow-up question, one sentence, no preamble, no "great question," no greeting. If there's prior conversation, build on their actual last answer instead of pivoting to a fresh, unrelated angle.

There's a live crowd watching this exchange in a Discord thread, and part of your job as the interviewer is to actually try to draw the player into a fun exchange when the moment allows it — a well-aimed, playful question invites a better answer than a flat factual one. How the crowd reacts should track the WHOLE conversation so far, not just judge the last line in isolation: a single decent line barely gets a ripple, but if the player's been on a roll — funny, candid, a little cocky in a likeable way — the energy should genuinely build across the interview ("They're loving this one now."). The same goes the other direction: one clipped answer isn't enough for boos, but a pattern of dismissive, arrogant, or needlessly harsh answers can earn a real negative turn as it accumulates. A normal, ordinary answer — most of them — earns nothing at all. Leave "crowdReaction" null far more often than not; never invent a reaction just to have one, and never react this strongly on a single mild line. If there's no prior answer yet (this is the first question), it must be null. When you do write one, keep it to a short stage-direction style line in third person, e.g. "The crowd bursts out laughing.", "A ripple of applause.", "A few boos ring out.", "An awkward silence." — never address the player directly in it, that's what the question is for.

Never mention that you're a model, an AI, or that this is automated. Respond with ONLY a JSON object shaped exactly like {"crowdReaction": string | null, "question": string}. No other text.`;

async function callGroq(context: InterviewContext, priorQA: InterviewQA[], apiKey: string): Promise<InterviewNextQuestion | null> {
  try {
    const res = await fetchGroqWithRateLimitRetry(apiKey, {
      model: MODEL,
      // Subida de 0.6 a 0.85 junto con la reescritura del prompt de arriba
      // (2026-09-19) — a 0.6 el modelo tendía a marcar cada regla por turno en la
      // misma frase (checklist), justo el efecto robótico reportado. Con ejemplos de
      // tono concretos en el prompt, más temperatura da variación de verdad en vez
      // de la misma estructura de frase repetida entrevista tras entrevista.
      temperature: 0.85,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ context, priorQA }) },
      ],
    });
    if (!res || !res.ok) return null;

    const json: unknown = await res.json();
    const text = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const { question, crowdReaction } = (parsed ?? {}) as { question?: unknown; crowdReaction?: unknown };
    if (typeof question !== "string" || question.length === 0 || question.length > MAX_QUESTION_CHARS) return null;
    // Cualquier forma rara del campo opcional (ausente, no string, vacío, demasiado
    // largo) cae a `null` sin más — nunca invalida la pregunta entera por esto, el
    // ambiente de la multitud es lo de menos frente a tener pregunta real o no.
    const cleanCrowdReaction =
      typeof crowdReaction === "string" && crowdReaction.length > 0 && crowdReaction.length <= MAX_CROWD_REACTION_CHARS ? crowdReaction : null;
    return { question, crowdReaction: cleanCrowdReaction };
  } catch {
    return null;
  }
}

/** Nunca lanza: sin `GROQ_API_KEY`, con timeout, o con una respuesta ilegible, cae a
 * `null` — el bot simplemente no manda la siguiente pregunta (el hilo sigue abierto
 * igual, la gente puede seguir hablando libremente). */
export async function generateNextInterviewQuestion(
  context: InterviewContext,
  priorQA: InterviewQA[],
): Promise<InterviewNextQuestion | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return callGroq(context, priorQA, apiKey);
}

export type InterviewMood = "fun" | "normal" | "bad";

const MOOD_SYSTEM_PROMPT = `You just watched a short post-match tennis interview end to end. Read the whole exchange and judge its overall vibe as exactly one of:
- "fun": genuinely funny, candid, or playful answers — the kind of interview people would enjoy reading, even if only one or two answers really landed
- "normal": an ordinary, straightforward interview — professional, nothing special either way
- "bad": flat, dismissive, arrogant, or needlessly harsh answers that made for an unpleasant exchange

Judge the whole conversation, not just the last line. Respond with ONLY a JSON object shaped exactly like {"mood": "fun" | "normal" | "bad"}. No other text.`;

async function callGroqForMood(qa: InterviewQA[], apiKey: string): Promise<InterviewMood | null> {
  try {
    const res = await fetchGroqWithRateLimitRetry(apiKey, {
      model: MODEL,
      temperature: 0.3, // clasificación, no generación creativa — determinismo por encima de variedad aquí
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MOOD_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ qa }) },
      ],
    });
    if (!res || !res.ok) return null;

    const json: unknown = await res.json();
    const text = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const { mood } = (parsed ?? {}) as { mood?: unknown };
    if (mood === "fun" || mood === "normal" || mood === "bad") return mood;
    return null;
  } catch {
    return null;
  }
}

/**
 * Decide la línea de cierre de `lib/discordBot/interactions/interviewMessage.ts`
 * (pedido explícito, 2026-09-19: "ladies and gentlemen" para una divertida, "Alright,
 * thank you" para una normal, solo "Thank you" seco para una floja) — mismo patrón de
 * fallo silencioso que el resto de este fichero: sin transcripción, sin
 * `GROQ_API_KEY`, con timeout, o con una respuesta ilegible, cae a `null` y quien
 * llama usa el cierre neutro de "normal" por defecto.
 */
export async function assessInterviewMood(qa: InterviewQA[]): Promise<InterviewMood | null> {
  if (qa.length === 0) return null;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return callGroqForMood(qa, apiKey);
}
