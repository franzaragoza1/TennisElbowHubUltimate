/**
 * Lee las estadísticas del "Build" (Character Sheet de TE4) directamente de un
 * screenshot subido — pedido explícito: en vez de que el jugador teclee cada casilla a
 * mano, un modelo con visión las lee por él y el jugador solo revisa/corrige antes de
 * guardar (nunca se escribe nada en la base de datos desde aquí, ver
 * app/account/actions.ts::extractBuildStats).
 *
 * Groq (el proveedor del resto de llamadas a IA de este repo) no tiene ningún modelo
 * con visión en su catálogo actual en esta cuenta (comprobado en vivo contra
 * GET /openai/v1/models antes de elegir esto) — OpenRouter sí, con el mismo endpoint
 * compatible con OpenAI que ya se usa para Groq, solo cambia la URL base, el modelo, y
 * que el mensaje del usuario lleva una imagen además de texto.
 */
import { ALL_STAT_KEYS, ACCELERATION_TRAITS, ARCHETYPES, type AccelerationTrait, type Archetype, type StatKey } from "./buildStats";

// Elegido tras comparar precios reales de OpenRouter (2026-09-07, ver GET
// /api/v1/models): más barato que gpt-4o-mini en las dos direcciones (~33% menos) y
// de un proveedor grande y fiable, no un modelo experimental/gratuito — para leer
// números con precisión de una interfaz real, la fiabilidad importa más que llegar a
// coste cero, y a la escala real de este sitio (unos cientos de jugadores, cada
// subida es un hecho puntual, no algo que se repita por página vista) el coste total
// esperado ya es de céntimos sueltos con cualquiera de los dos modelos.
const MODEL = "google/gemini-2.5-flash-lite";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 20000;
const MAX_TOKENS = 700;

export type ExtractedBuildStats = Partial<Record<StatKey, number>> & {
  archetype?: Archetype;
  accelerationTrait?: AccelerationTrait;
};

/**
 * Descrito por POSICIÓN y orden de lectura, nunca por el texto de las etiquetas —
 * pedido explícito: TE4 tiene esta misma pantalla en varios idiomas del cliente
 * (mismo motivo que las tablas por idioma de parsers/matchLogPage.ts para los
 * MatchLog), así que un screenshot real puede llegar en francés, español, etc. Un
 * texto de sistema que buscara "RALLY" o "Forehand Power" fallaría con cualquier
 * idioma que no sea inglés; la disposición de las barras en la pantalla es la misma
 * pase lo que pase, y leer un número no necesita entender ningún idioma.
 */
const SYSTEM_PROMPT = `You read a screenshot of the "Character Sheet" screen from the tennis game Tennis Elbow 4. This screen can appear in any of the game's client languages — never rely on recognizing English section names or labels, since they may be translated. Instead, identify each value by its POSITION in the fixed layout described below, which is the same regardless of language:

- Top-left column, 6 bars top to bottom: Forehand Power, Forehand Consistency, Forehand Precision, Backhand Power, Backhand Consistency, Backhand Precision.
- Directly below that same column, 3 more bars: Service Power, Service Consistency, Service Precision.
- Below that, 4 more bars: Forehand Volley, Backhand Volley, Smash, Net Presence.
- A middle column, 5 bars top to bottom: Focus, Counter, Lob, Drop Shot, Top Spin.
- A column to the right of that, 3 bars: Speed, Stamina, Muscle Tone.
- Near the top of the character portrait area, a short label naming the player's archetype — one of a fixed set of values (see below).
- A small left/right selector control (not a bar) labeled "Acceleration Trait" showing one of a fixed set of values — read whichever value is currently selected.

FIRST, decide: does the image CLEARLY show this exact screen, with this exact layout of grouped bars actually legible (regardless of what language the labels are in)? Set "screenshotRecognized" to true or false accordingly. This is the single most important thing you do — get it wrong and you mislead a real person about their own data.

- If "screenshotRecognized" is false (blank image, unrelated image, wrong game screen, too blurry/small to read, or anything else that isn't clearly this exact screen with legible numbers), respond with EXACTLY {"screenshotRecognized": false} and nothing else. Do not include any other key. Do not invent placeholder or "typical" numbers to fill the response — that would show a real person false data about themselves, which is worse than showing them nothing.
- Only if "screenshotRecognized" is true, also include the fields below that you can actually read.

Respond with ONLY a JSON object. When recognized, use exactly these keys: "screenshotRecognized", ${ALL_STAT_KEYS.join(", ")}, archetype, accelerationTrait.

Rules:
- Each of the ${ALL_STAT_KEYS.length} stat keys must be a plain JSON number (the percentage shown on that bar) if you can read it clearly, or omitted entirely if that specific field isn't visible/legible. Never guess, estimate, or fill in a "typical" value for a number you can't actually see.
- "archetype" must be one of exactly these English values, translated back to English if the client language isn't English: ${ARCHETYPES.join(", ")}. If you can't confidently match the shown value to one of these exactly, omit the key rather than guess.
- "accelerationTrait" must be one of exactly these English values, translated back to English if the client language isn't English: ${ACCELERATION_TRAITS.join(", ")}. If you can't confidently match the shown value to one of these exactly, omit the key rather than guess.
- Never wrap numbers in quotes, never include a "%" sign, never include any key not listed above (in particular, do not include a "points" key — it is calculated separately, never read from the image).
- No prose, no markdown, no explanation — the entire response must be the JSON object and nothing else.`;

interface OcrResult {
  data: ExtractedBuildStats;
}

function isPlainNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isAccelerationTrait(v: unknown): v is AccelerationTrait {
  return typeof v === "string" && (ACCELERATION_TRAITS as readonly string[]).includes(v);
}

function isArchetype(v: unknown): v is Archetype {
  return typeof v === "string" && (ARCHETYPES as readonly string[]).includes(v);
}

/** Validación defensiva campo a campo — nunca todo-o-nada: si el modelo devolvió
 * basura en una casilla, esa casilla concreta se descarta (queda sin rellenar, el
 * jugador la escribe a mano) en vez de tirar toda la extracción por un solo campo
 * malo. Nunca se acepta un string coaccionado a número — si no vino ya como número
 * JSON limpio, se descarta, para no colar un valor mal leído con más confianza de la
 * que merece. */
function sanitize(parsed: unknown): ExtractedBuildStats {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const out: ExtractedBuildStats = {};

  // Puerta obligatoria: si el modelo no reconoció la pantalla como el Character
  // Sheet real (o directamente no la puso), se descarta TODO lo demás, aunque venga
  // relleno — un modelo de visión puede inventarse una "build típica" completa y
  // plausible ante una imagen que no puede leer en vez de admitir que no sabe (visto
  // en real contra una imagen sin contenido: devolvió 21 cifras redondas y un
  // arquetipo de la nada). Los números caen todos dentro de 0-100 igual, así que la
  // comprobación de rango de más abajo no lo detecta por sí sola — hace falta esta
  // puerta explícita antes de fiarse de nada.
  if (obj.screenshotRecognized !== true) return out;

  for (const key of ALL_STAT_KEYS) {
    const v = obj[key];
    if (isPlainNumber(v) && v >= 0 && v <= 100) out[key] = Math.round(v);
  }
  if (isArchetype(obj.archetype)) out.archetype = obj.archetype;
  if (isAccelerationTrait(obj.accelerationTrait)) out.accelerationTrait = obj.accelerationTrait;

  return out;
}

async function callOpenRouter(dataUri: string, apiKey: string): Promise<OcrResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Read the stats from this Character Sheet screenshot." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
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

    return { data: sanitize(parsed) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nunca lanza: sin `OPENROUTER_API_KEY`, con timeout, o con una respuesta ilegible,
 * devuelve `null` — el jugador simplemente rellena el formulario a mano, mismo
 * contrato que el resto de funciones de IA de este repo (lib/h2hNarrative.ts,
 * lib/playerOverview.ts).
 */
export async function extractBuildFromScreenshot(dataUri: string): Promise<ExtractedBuildStats | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const result = await callOpenRouter(dataUri, apiKey);
  if (!result) return null;
  if (Object.keys(result.data).length === 0) return null;

  return result.data;
}
