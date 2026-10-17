/**
 * Proveedor de IA de todo el sitio (borradores de noticias, entrevistas, h2h, previews,
 * overviews, sugerencias de nombres). Todos hablan el mismo dialecto "chat completions" de
 * OpenAI, así que cambiar de proveedor es solo cambiar URL, modelo y clave aquí.
 *
 * 2026-10-17: Groq (plan gratuito, 200000 tokens/DÍA) se agotaba y las entrevistas se
 * cortaban; ahora se usa Gemini (endpoint compatible con OpenAI) en cuanto hay
 * `GEMINI_API_KEY`. Sin ella, y con `GROQ_API_KEY`, se sigue usando Groq como antes.
 */
const useGemini = Boolean(process.env.GEMINI_API_KEY);

export const LLM_URL = useGemini
  ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
  : "https://api.groq.com/openai/v1/chat/completions";

export const LLM_MODEL = process.env.LLM_MODEL || (useGemini ? "gemini-3.8-flash" : "openai/gpt-oss-120b");

/** Parámetros extra de cada petición: poco razonamiento oculto (en los dos proveedores el
 * razonamiento gasta del `max_tokens`, y un presupuesto comido deja el JSON sin escribir). */
export const LLM_EXTRA = { reasoning_effort: "low" } as const;

/** `undefined` sin clave: quien llama ya cae a su plan B (nunca lanza). */
export function llmApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || undefined;
}
