/**
 * Preguntas de la mini-entrevista tras un partido que hace el bot de Discord — mismo
 * patrón Groq/JSON/"nunca lanza, cae a null" que `lib/newsGeneration/draft.ts`. Desde
 * el 2026-09-20 la LONGITUD ya no es un número fijo contado en código: es el propio
 * modelo quien decide cuándo la conversación llega a un cierre natural
 * (`InterviewNextQuestion.question === null`, ver su comentario más abajo) — el único
 * límite que sigue viviendo en código es un techo de seguridad
 * (`lib/discordBot/interactions/interviewMessage.ts::MAX_QUESTIONS_SAFETY_CAP`) contra
 * un modelo que nunca decidiera parar solo.
 */
const MODEL = "openai/gpt-oss-120b"; // ver lib/newsGeneration/draft.ts — mismo modelo, mismo motivo (llama-3.3-70b-versatile desapareció del catálogo de Groq)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Subido de 8s a 20s (2026-10-17): una petición normal tarda ~1s, pero con el límite de 8000
// tokens/minuto de la cuenta, la 3ª-4ª seguida espera su `retry-after` (hasta ~10s) y el
// timeout viejo la cortaba antes de tiempo -> `null` -> la entrevista se cerraba tras 1-2
// preguntas (visto en las 6 entrevistas de ese día, todas de 1-2 preguntas).
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
// Subido de 200 a 400 junto con la instrucción de responder de verdad a lo que
// pregunte el jugador (2026-09-20) — bug real encontrado probando exactamente el
// caso reportado ("do you know which Chinese cuisine..."): el modelo respondía de
// maravilla ("Hangzhou is famous for Zhejiang cuisine – think silky West Lake fish
// and the rich Dongpo pork...") Y encadenaba su propia pregunta en el mismo mensaje,
// pero esa respuesta-más-pregunta pasaba de sobra los 200 caracteres de antes
// (pensados para una única pregunta corta) y `callGroq` la descartaba entera como si
// hubiera fallado, cayendo al cierre de la entrevista.
const MAX_QUESTION_CHARS = 400;
const MAX_CROWD_REACTION_CHARS = 100;
// `gpt-oss-120b` es un modelo "de razonamiento": gasta parte del presupuesto de tokens
// pensando en un campo `reasoning` aparte ANTES de escribir el `content` final. Con
// 150 (el límite original) el razonamiento se comía el presupuesto entero y no
// quedaba nada para el JSON de verdad — Groq devolvía 400 "json_validate_failed" con
// `failed_generation` vacío, `callGroq` lo trataba como fallo y caía a `null` en
// SILENCIO. Subido a 600 en su momento (probado en vivo: 150 falla siempre, 600
// nunca) — y otra vez a 900 el 2026-09-20 al añadir las instrucciones de "responde de
// verdad si te preguntan algo" y "decide tú cuándo cerrar la entrevista": mismo fallo
// EXACTO reapareció con 600 en cuanto el prompt se hizo más largo/complejo (más para
// que el modelo "piense" antes de escribir el JSON). Probado en vivo contra la API
// real tras la subida: 600 falla de forma repetible con el prompt nuevo, 900 nunca.
const MAX_TOKENS = 900;

// Techo defensivo para la espera de un 429 — Groq ha devuelto entre 6 y 9s de
// `retry-after` en pruebas reales contra esta misma cuenta, nunca visto por encima
// de esto; sin techo, un valor anómalo de la API dejaría el hilo colgado sin motivo.
const MAX_RATE_LIMIT_WAIT_MS = 20_000;

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
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
    if (res.status !== 429 || attempt === MAX_ATTEMPTS - 1) return res;
    // Límite DIARIO de tokens (TPD, 200000 en el plan gratuito): esperar no lo arregla (el
    // `retry-after` son minutos u horas), se devuelve ya y el llamador usa su plan B.
    if (/tokens per day|\(TPD\)/i.test(await res.clone().text().catch(() => ""))) return res;

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
  /** Racha/forma YA CALCULADA de cada jugador de ESTE partido (mismo cálculo que
   * `nextOpponent.formNote`, lib/newsGeneration/opponentFormTier.ts) — null salvo que
   * sea de verdad buena (Solid/Great). Bug real reportado, 2026-10-02: la pregunta de
   * apertura decía "you're on a five-match winning streak", un número que el modelo se
   * inventó CONTANDO él solo desde las líneas sueltas de "playerRecentForm" — esto le
   * da el número ya correcto para que nunca tenga que contarlo. */
  playerFormNote: string | null;
  opponentFormNote: string | null;
  /** Solo presente cuando el jugador GANÓ este partido y su próxima ronda ya tiene
   * algo real que preguntar (lib/nextOpponent.ts::getNextOpponentLookahead) — pedido
   * explícito, 2026-09-17. `formNote` (solo en "known") viene ya filtrado por
   * lib/newsGeneration/opponentFormTier.ts: null salvo que la forma reciente de ese
   * rival sea de verdad buena (Solid/Great), nunca para Bad/Mediocre/Normal.
   * `recentResult` (solo en "known") es su partido más reciente de verdad tal cual lo
   * da lib/newsGeneration/recentForm.ts ("W vs Celestial 6/3 6/3 — QF Beijing"), o
   * null sin historial — el ÚNICO dato real sobre cómo llegó hasta aquí; bug real
   * reportado, 2026-09-30: sin esto el modelo se inventaba el rival y el tipo de
   * victoria enteros ("his walkover win over Hardy13", ninguno de los dos real). */
  nextOpponent?:
    | { kind: "known"; name: string; formNote: string | null; recentResult: string | null }
    | { kind: "candidates"; names: [string, string] };
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
 * todavía).
 *
 * `question: null` (pedido explícito del propietario, 2026-09-20) significa "esta
 * entrevista ya llegó a un cierre natural, no hace falta preguntar nada más" — quien
 * llama (`interviewMessage.ts`) lo trata exactamente igual que cualquier otro fallo de
 * generación: cierra la entrevista con lo que ya hay. Reemplaza el tope fijo de
 * siempre-3-preguntas de antes: forzar el mismo número exacto pasara lo que pasara en
 * la conversación era justo lo que se sentía robótico (capturas reales de Discord: el
 * bot ignorando por completo que el jugador se había desviado a bromear sobre comida
 * china, y volviendo a su siguiente pregunta programada como si nada). */
export interface InterviewNextQuestion {
  crowdReaction: string | null;
  question: string | null;
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

"playerRecentForm"/"opponentRecentForm" are lists of past results, not a pre-counted streak — never count wins yourself from them to state a streak length or claim it spans specific tournaments (a real interview once said "a five-match winning streak across Beijing and the US Open", a number and a claim nobody computed, wrong on both counts). If you want to mention a streak for either player in THIS match, "playerFormNote"/"opponentFormNote" are the only valid source — already computed, null when there isn't a real one to mention — use its exact wording or don't mention a streak at all. The recent-form lists are for everything else a streak note can't give you: an opponent they've played before, a tournament they're repeating well or badly in, a close-match pattern — read from the actual lines for those, just never turn them into a counted streak number yourself.

Each line in "playerRecentForm"/"opponentRecentForm" is its own separate match, with its own opponent, round, and tournament — never stitch two of those lines into one storyline (a real interview once asked "after that five-set loss in New York, how did you reset to dominate Alejandro so thoroughly here?", inventing both a causal "comeback" narrative between two unrelated matches against two different opponents in two different tournaments, AND the set count — the real score was four sets, not five). A past result can only be brought up on its own terms (that match, that opponent, that score, exactly as the line states it) — never framed as the reason for, or the thing being avenged/redeemed in, a DIFFERENT match against a DIFFERENT opponent. Any number you quote from a line — a score, a set count, a round — must be copied exactly as written, never recomputed, rounded, or rephrased into a different count.

Pick ONE real angle and commit to it — don't stack two or three observations into a single sentence. Good angles: a swing in the match (dropped the first set then flipped it, a tight tiebreak), a ranking gap or upset, a genuine pattern in recent form (a repeat opponent, a string of close matches, or a streak from "playerFormNote"/"opponentFormNote"), or what the category means for this result.

About the surface: bring it up only if it's genuinely the sharpest angle for THIS question — most questions shouldn't touch it at all. If you do, talk about the VENUE the way a real journalist would ("Cincinnati's courts have a reputation for playing fast", "this place chews up big servers"), never as a spec sheet. The exact move of gluing the speed category and color together — "on this medium-fast blue-green cement" — is banned outright, in those words or any close variant. Bring the surface up at most once across the whole conversation; if it already came up, pick a different angle entirely.

If "nextOpponent" is present, that's the only question to ask: react to the named opponent, optionally weaving in "formNote" and/or "recentResult" if given (never mention form or their path here otherwise) — or ask about the prospect of facing either of the two candidates if it isn't decided yet. "recentResult" is their actual most recent match; if you reference it, use exactly the result/opponent/round it states, never a different one. Never invent how they reached this round — no made-up opponent name, no walkover or any other outcome, no score — beyond what "formNote"/"recentResult" literally give you; if both are absent, react to facing them by name only, don't speculate about their path at all.

Have a little fun with it — a dry one-liner, some genuine needling, a "let's be honest" moment. You're a real person here, not a neutral question-generator. Never at the player's expense, and never let the bit run longer than the actual question.

Tone examples (context varies every time — never reuse these lines, they're here to show the voice, not to be recycled):
- "You dropped the first set 2-6 and still found a way through — walk me through the exact moment that flipped."
- "Straight sets again. Is anyone actually taking a set off you this month, or are we all just watching at this point?"
- "You've beaten this guy twice already this season — does he know that, or is he about to find out live?"

Ask exactly ONE natural follow-up question, one sentence, no preamble, no "great question," no greeting. If there's prior conversation, build on their actual last answer instead of pivoting to a fresh, unrelated angle.

This is a real back-and-forth, not a fixed script — if the player asks YOU something directly (their name, an opinion, a fact about the tournament), answer it briefly and naturally as part of your message, before or instead of your next question. If they call out a non-answer or point out you dodged something, own it and actually respond — never just rephrase their own question back at them as if it were a fresh one of yours, and never plow ahead to your next planned topic like the last thing they said didn't happen. Treat a joke or a tangent as something to play along with for a line, not something to route around.

There's a live crowd watching this exchange in a Discord thread, and part of your job as the interviewer is to actually try to draw the player into a fun exchange when the moment allows it — a well-aimed, playful question invites a better answer than a flat factual one. Most answers, even good honest ones, are just an answer: "crowdReaction" is null far more often than not, and being earnest, confident, or on-topic is not by itself a reason to react — a sincere line like "it's just instinct, you learn it by playing" or "these are the moments you live for" is a completely normal answer, not a moment, even when it's a nice thing to say. Save it for an answer that's actually a MOMENT on its own: a genuinely funny line, a bold brag, a cocky tease, a sharp comeback, a coy dodge played for laughs — it can react to a single line like that the first time it happens, it doesn't need a build-up first. Same the other direction: one sharp, dismissive, or arrogant answer can earn a light negative beat on its own, and a pattern of them builds into real boos. When you do write one, ground it in what THIS specific answer actually did rather than reaching for a default — vary which crowd behavior fits (laughter, gasps, applause, murmurs, stunned silence, boos...) instead of the same phrase every time, and never repeat a reaction you've already used earlier in this same interview. If there's no prior answer yet (this is the first question), it must be null. Keep it to a short stage-direction style line in third person, e.g. "The crowd bursts out laughing.", "A ripple of applause.", "A few boos ring out.", "An awkward silence." — never address the player directly in it, that's what the question is for.

A real interview doesn't run a fixed number of questions — you decide when it's run its course. Look at the whole conversation in "priorQA": once you've had at least two or three real exchanges and it feels like a natural, satisfying place to stop (the player's given you something good to end on, or the energy's clearly winding down), set "question" to null instead of forcing another one — that's the signal to wrap up, so don't also write a question when you do this. Don't cut it short after just one exchange, and don't drag it out mechanically once it's said what it had to say either. Exception: if "nextOpponent" is present, that question always has to be asked for real (never null) — it's the one thing that still needs covering before this closes.

Never mention that you're a model, an AI, or that this is automated. Respond with ONLY a JSON object shaped exactly like {"crowdReaction": string | null, "question": string | null}. No other text.`;

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
      // Menos razonamiento oculto = menos tokens por pregunta (cuentan para el límite por
      // minuto) y respuestas más rápidas; la pregunta no necesita pensar a fondo.
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ context, priorQA }) },
      ],
    });
    if (!res || !res.ok) { console.warn("[interview] Groq", res?.status, res ? (await res.text()).slice(0, 300) : "no response"); return null; }

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
    // `question: null` es una respuesta válida a propósito (cierre natural decidido
    // por el propio modelo, ver el comentario de InterviewNextQuestion) — cualquier
    // OTRA forma que no sea ni null ni un string real sí sigue siendo un fallo de
    // generación de verdad.
    if (question !== null && (typeof question !== "string" || question.length === 0 || question.length > MAX_QUESTION_CHARS)) return null;
    // Cualquier forma rara del campo opcional (ausente, no string, vacío, demasiado
    // largo) cae a `null` sin más — nunca invalida la pregunta entera por esto, el
    // ambiente de la multitud es lo de menos frente a tener pregunta real o no. Sin
    // pregunta real que acompañar (cierre natural), tampoco tiene sentido un
    // `crowdReaction` — no hay mensaje al que engancharlo.
    const cleanCrowdReaction =
      question !== null && typeof crowdReaction === "string" && crowdReaction.length > 0 && crowdReaction.length <= MAX_CROWD_REACTION_CHARS
        ? crowdReaction
        : null;
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
    if (!res || !res.ok) { console.warn("[interview] Groq", res?.status, res ? (await res.text()).slice(0, 300) : "no response"); return null; }

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
