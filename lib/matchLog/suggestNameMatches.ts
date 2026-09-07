/**
 * "Find matches with AI" en `/admin/match-log` — CLAUDE.md §3 ya preveía que la
 * reconciliación de identidad de jugador fuera "semiautomática con confirmación
 * manual"; esto es esa mitad automática. Mismo proveedor y patrón que
 * `lib/newsGeneration/draft.ts` (Groq, JSON forzado, nunca lanza) — nunca escribe
 * `player_known_names` directamente: solo propone, `/admin/match-log` aprueba o
 * descarta cada sugerencia a mano.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { matchLogFiles, playerKnownNames, playerNameSuggestions, players } from "@/db/schema";

// llama-3.3-70b-versatile (usado por lib/newsGeneration/draft.ts) desapareció por
// completo del catálogo de Groq — comprobado contra GET /openai/v1/models con esta
// misma clave, ya no está ni siquiera listado. openai/gpt-oss-120b es, de los
// modelos de chat de propósito general que SÍ siguen ahí, el más grande disponible.
const MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 15000;
const BATCH_SIZE = 25;
// Mismo motivo que lib/newsGeneration/draft.ts (comentario original, 2.2s de margen
// deja ~27/min bajo el tope de 30/min del plan gratuito de Groq).
const GROQ_CALL_SPACING_MS = 2200;

const SYSTEM_PROMPT = `You help match TE4 (Tennis Elbow 4) online tennis player nicknames from a local match log to a known roster of tour players.

You get a JSON object with:
- "unresolvedNames": names that appeared in a match log but don't exactly match anyone on the tour roster.
- "roster": the exact display names of every real tour player.

For EACH unresolved name, decide whether it plausibly refers to ONE SPECIFIC roster player — a nickname, a shortened first name, an initial+surname, or a very close spelling variant of that exact player — or whether it's a different, unrelated person (a casual online opponent who isn't on the tour at all). Most unresolved names will NOT match anyone — that is the normal, expected case. Only suggest a match when you are reasonably confident; when in doubt, say no match.

Rules:
- "suggestedPlayer" must be copied EXACTLY, character for character, from the given roster list, or be null. Never invent, alter, or guess a name that isn't in the roster.
- Never suggest a match just because two names share a common word — the connection has to be about the SAME person's name, not shared vocabulary.
- Skip names that are useless information for the tour instead of forcing a guess: generic CPU/bot/AI opponent names (e.g. "CPU", "Bot", "AI", a difficulty label), or a name that's clearly not a real handle at all (random keyboard mashing, a placeholder, a single stray character). These aren't real people on the tour — always answer null for them, never try to match them to a roster player just because some letters overlap.
- Respond with ONLY a JSON object shaped exactly like {"matches": [{"unresolvedName": string, "suggestedPlayer": string | null, "reason": string | null}]}, one entry per unresolved name you were given, in the same order.`;

interface RawSuggestion {
  unresolvedName: string;
  suggestedPlayer: string | null;
  reason: string | null;
}

function parseGroqMatches(json: unknown): RawSuggestion[] {
  if (!json || typeof json !== "object") return [];
  const matches = (json as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];

  const out: RawSuggestion[] = [];
  for (const m of matches) {
    if (!m || typeof m !== "object") continue;
    const row = m as Record<string, unknown>;
    if (typeof row.unresolvedName !== "string") continue;
    out.push({
      unresolvedName: row.unresolvedName,
      suggestedPlayer: typeof row.suggestedPlayer === "string" ? row.suggestedPlayer : null,
      reason: typeof row.reason === "string" ? row.reason : null,
    });
  }
  return out;
}

async function callGroq(unresolvedNames: string[], roster: string[], apiKey: string): Promise<RawSuggestion[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ unresolvedNames, roster }) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];

    const json: unknown = await res.json();
    const text = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (typeof text !== "string") return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    return parseGroqMatches(parsed);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export interface SuggestMatchesResult {
  scanned: number;
  suggested: number;
  alreadyHandled: number;
}

/**
 * Recorre TODOS los `unresolvedNames` acumulados en `match_log_files`, descarta los
 * que ya tienen alias/mote conocido o ya se sugirieron/descartaron antes, y le pide
 * a Groq una sugerencia por lote. Nunca lanza (sin `GROQ_API_KEY`, o si Groq falla,
 * simplemente no sugiere nada esta vez — igual que `draftNewsStory`).
 */
export async function generateNameSuggestions(): Promise<SuggestMatchesResult> {
  const apiKey = process.env.GROQ_API_KEY;

  const files = await db.select({ unresolvedNames: matchLogFiles.unresolvedNames }).from(matchLogFiles);
  // Deduplicado insensible a mayúsculas (el mismo mote puede aparecer con distinta
  // capitalización en dos ficheros distintos) — se conserva la primera grafía vista.
  const allUnresolved = new Map<string, string>();
  for (const f of files) {
    if (!Array.isArray(f.unresolvedNames)) continue;
    for (const n of f.unresolvedNames) {
      if (typeof n === "string" && !allUnresolved.has(n.toLowerCase())) allUnresolved.set(n.toLowerCase(), n);
    }
  }

  const [knownNameRows, existingSuggestionRows, playerRows] = await Promise.all([
    db.select({ name: playerKnownNames.name }).from(playerKnownNames),
    db.select({ unresolvedName: playerNameSuggestions.unresolvedName }).from(playerNameSuggestions),
    db.select({ id: players.id, name: players.displayName }).from(players),
  ]);
  const known = new Set(knownNameRows.map((r) => r.name.toLowerCase()));
  const alreadySuggested = new Set(existingSuggestionRows.map((r) => r.unresolvedName.toLowerCase()));
  const playerNameSet = new Set(playerRows.map((p) => p.name.toLowerCase()));

  const toScan = [...allUnresolved.entries()]
    .filter(([lower]) => !known.has(lower) && !alreadySuggested.has(lower) && !playerNameSet.has(lower))
    .map(([, original]) => original);

  if (!apiKey || toScan.length === 0) {
    return { scanned: toScan.length, suggested: 0, alreadyHandled: allUnresolved.size - toScan.length };
  }

  const roster = playerRows.map((p) => p.name);
  const nameToId = new Map(playerRows.map((p) => [p.name.toLowerCase(), p.id]));

  let suggested = 0;
  let calledOnce = false;
  for (let i = 0; i < toScan.length; i += BATCH_SIZE) {
    const batch = toScan.slice(i, i + BATCH_SIZE);
    if (calledOnce) await new Promise((resolve) => setTimeout(resolve, GROQ_CALL_SPACING_MS));
    calledOnce = true;

    const raw = await callGroq(batch, roster, apiKey);
    const rows: { unresolvedName: string; suggestedPlayerId: number; reason: string | null; status: "pending" }[] = [];
    for (const r of raw) {
      // El modelo solo puede confirmar o descartar un nombre que ya le dimos, nunca
      // "corregirlo" a otra cosa — y el jugador sugerido tiene que ser EXACTO de la
      // lista dada, nunca inventado (misma idea que everyNumberIsBackedByFacts en
      // lib/newsGeneration/draft.ts, aplicada a nombres en vez de a cifras).
      if (!batch.includes(r.unresolvedName) || !r.suggestedPlayer) continue;
      const playerId = nameToId.get(r.suggestedPlayer.toLowerCase());
      if (!playerId) continue;
      rows.push({ unresolvedName: r.unresolvedName, suggestedPlayerId: playerId, reason: r.reason, status: "pending" });
    }

    if (rows.length > 0) {
      await db.insert(playerNameSuggestions).values(rows).onConflictDoNothing({ target: playerNameSuggestions.unresolvedName });
      suggested += rows.length;
    }
  }

  return { scanned: toScan.length, suggested, alreadyHandled: allUnresolved.size - toScan.length };
}

/**
 * Aprobar una sugerencia = exactamente lo mismo que si el admin hubiera escrito el
 * nombre a mano en `/admin/players/[id]` (`addPlayerKnownName`) — inserta en
 * `player_known_names` y relanza el procesado de cualquier fichero que trajera ese
 * nombre sin resolver, para que los partidos que dependían de él enlacen ya mismo.
 */
export async function approveNameSuggestion(suggestionId: number): Promise<{ affectedFileIds: number[] } | null> {
  const [suggestion] = await db.select().from(playerNameSuggestions).where(eq(playerNameSuggestions.id, suggestionId));
  if (!suggestion || suggestion.status !== "pending") return null;

  await db
    .insert(playerKnownNames)
    .values({ playerId: suggestion.suggestedPlayerId, name: suggestion.unresolvedName })
    .onConflictDoNothing();
  await db.update(playerNameSuggestions).set({ status: "approved" }).where(eq(playerNameSuggestions.id, suggestionId));

  const files = await db.select({ id: matchLogFiles.id, unresolvedNames: matchLogFiles.unresolvedNames }).from(matchLogFiles);
  const lower = suggestion.unresolvedName.toLowerCase();
  const affectedFileIds = files
    .filter((f) => Array.isArray(f.unresolvedNames) && f.unresolvedNames.some((n) => typeof n === "string" && n.toLowerCase() === lower))
    .map((f) => f.id);

  return { affectedFileIds };
}

export async function dismissNameSuggestion(suggestionId: number): Promise<void> {
  await db.update(playerNameSuggestions).set({ status: "dismissed" }).where(eq(playerNameSuggestions.id, suggestionId));
}
