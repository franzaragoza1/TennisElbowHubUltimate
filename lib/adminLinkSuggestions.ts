/**
 * Sugerencias de vínculo cuenta↔jugador para el admin — pedido explícito
 * (2026-09-16): alguien puede haber iniciado sesión con Discord alguna vez (existe su
 * `authUsers`) sin haber pasado nunca por el reclamo manual de su perfil. El admin ve
 * estos "huérfanos" emparejados por IA contra jugadores todavía sin dueño, y decide
 * cuáles proponer — nunca vincula solo, ver `players.pendingLinkUserId` en
 * db/schema.ts para el resto del flujo (el propio jugador confirma después).
 */
import { and, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { authAccounts, authUsers, playerClaimRequests, playerKnownNames, players } from "@/db/schema";

const MODEL = "openai/gpt-oss-120b"; // ver lib/newsGeneration/draft.ts — mismo modelo, mismo motivo
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 15000; // listas más largas que el resto de usos de Groq del sitio
const MAX_TOKENS = 800;
// Este modelo tiene un límite de 8000 tokens POR MINUTO en la cuenta (no de contexto
// ni de payload) — bug real encontrado, 2026-09-16: con los ~500 jugadores reales sin
// dueño en una sola petición, Groq devolvía 413 "Request too large... on tokens per
// minute (TPM): Limit 8000, Requested 8605". Trocear en tandas de jugadores mantiene
// cada petición muy por debajo de eso pase lo que pase con el tamaño real de la tabla.
const PLAYERS_PER_BATCH = 150;
// Espaciado entre tandas — mismo motivo que GROQ_CALL_SPACING_MS en el viejo
// generateNewsDrafts (app/admin/news/actions.ts, ya retirado): varias tandas seguidas
// dentro del mismo minuto seguirían sumando contra el mismo tope de TPM.
const BATCH_SPACING_MS = 2500;

export interface UnclaimedAccountRow {
  userId: string;
  discordName: string;
  discordImage: string | null;
}

export interface UnclaimedPlayerRow {
  playerId: number;
  displayName: string;
  knownNames: string[];
}

/** Cuentas con Discord vinculado que NUNCA llegaron a reclamar (ni confirmar) un
 * jugador — ni `linkedUserId` ni `pendingLinkUserId` de ningún jugador apunta a
 * ellas. Sin `authUsers.name` no hay nada que comparar, así que se excluyen. */
export async function getUnclaimedAccounts(): Promise<UnclaimedAccountRow[]> {
  const linkedUserIds = db.select({ id: players.linkedUserId }).from(players).where(isNotNull(players.linkedUserId));
  const pendingLinkUserIds = db.select({ id: players.pendingLinkUserId }).from(players).where(isNotNull(players.pendingLinkUserId));

  const rows = await db
    .selectDistinct({ userId: authUsers.id, discordName: authUsers.name, discordImage: authUsers.image })
    .from(authUsers)
    .innerJoin(authAccounts, and(eq(authAccounts.userId, authUsers.id), eq(authAccounts.provider, "discord")))
    .where(and(isNotNull(authUsers.name), notInArray(authUsers.id, linkedUserIds), notInArray(authUsers.id, pendingLinkUserIds)));

  return rows.filter((r): r is UnclaimedAccountRow => r.discordName !== null);
}

/** Mismo criterio de exclusión que app/account/actions.ts::searchClaimablePlayers —
 * sin dueño y sin una solicitud de reclamo 'pending' ya en curso. */
export async function getUnclaimedPlayers(): Promise<UnclaimedPlayerRow[]> {
  const pendingClaimPlayerIds = db.select({ id: playerClaimRequests.playerId }).from(playerClaimRequests).where(eq(playerClaimRequests.status, "pending"));

  const [playerRows, knownNameRows] = await Promise.all([
    db
      .select({ playerId: players.id, displayName: players.displayName })
      .from(players)
      .where(and(isNull(players.linkedUserId), isNull(players.pendingLinkUserId), notInArray(players.id, pendingClaimPlayerIds))),
    db.select({ playerId: playerKnownNames.playerId, name: playerKnownNames.name }).from(playerKnownNames),
  ]);

  const knownNamesByPlayer = new Map<number, string[]>();
  for (const k of knownNameRows) {
    if (!knownNamesByPlayer.has(k.playerId)) knownNamesByPlayer.set(k.playerId, []);
    knownNamesByPlayer.get(k.playerId)!.push(k.name);
  }

  return playerRows.map((p) => ({ ...p, knownNames: knownNamesByPlayer.get(p.playerId) ?? [] }));
}

export interface SuggestedAccountLink {
  userId: string;
  discordName: string;
  discordImage: string | null;
  playerId: number;
  playerDisplayName: string;
}

async function callGroq(accounts: UnclaimedAccountRow[], candidatePlayers: UnclaimedPlayerRow[], apiKey: string): Promise<{ userId: string; playerId: number }[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You match Discord accounts to player profiles on an online tennis tour, by comparing names. You'll get two lists: "accounts" (id + Discord display name) and "players" (id + display name + any other known names/handles they've used). Propose a match only when you're genuinely confident it's the same person — an exact name, an obvious variant (capitalization, added numbers, an underscore, a common shortening), or a name that matches one of the player's known names. When in doubt, don't propose a match — a missed match costs nothing, a wrong one confuses a real person. Not every account needs a match, and not every player needs one. Never match the same account or the same player more than once. Respond with ONLY a JSON object shaped exactly like {"matches": [{"accountId": string, "playerId": number}]}. No other text.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              accounts: accounts.map((a) => ({ id: a.userId, name: a.discordName })),
              players: candidatePlayers.map((p) => ({ id: p.playerId, name: p.displayName, knownNames: p.knownNames })),
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
    const { matches } = (parsed ?? {}) as { matches?: unknown };
    if (!Array.isArray(matches)) return null;

    const out: { userId: string; playerId: number }[] = [];
    for (const m of matches) {
      if (typeof m !== "object" || m === null) continue;
      const { accountId, playerId } = m as { accountId?: unknown; playerId?: unknown };
      if (typeof accountId === "string" && typeof playerId === "number") out.push({ userId: accountId, playerId });
    }
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nunca lanza: sin `GROQ_API_KEY`, con timeout, o con una respuesta ilegible, esa
 * tanda simplemente no aporta ninguna sugerencia — el admin no ve un error visible,
 * como mucho una lista más corta de lo que podría haber sido. Toda pareja que Groq
 * proponga se revalida aquí contra las listas REALES (un id inventado, o repetido —
 * dentro de la misma tanda o entre tandas distintas — se descarta sin más): nunca se
 * confía en que el modelo solo devolvió ids que de verdad existían en lo que se le
 * mandó.
 */
export async function suggestAccountPlayerLinks(): Promise<SuggestedAccountLink[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];

  const [accounts, candidatePlayers] = await Promise.all([getUnclaimedAccounts(), getUnclaimedPlayers()]);
  if (accounts.length === 0 || candidatePlayers.length === 0) return [];

  const accountById = new Map(accounts.map((a) => [a.userId, a]));
  const playerById = new Map(candidatePlayers.map((p) => [p.playerId, p]));
  const usedAccounts = new Set<string>();
  const usedPlayers = new Set<number>();
  const out: SuggestedAccountLink[] = [];

  for (let i = 0; i < candidatePlayers.length; i += PLAYERS_PER_BATCH) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, BATCH_SPACING_MS));

    const batch = candidatePlayers.slice(i, i + PLAYERS_PER_BATCH);
    const matches = await callGroq(accounts, batch, apiKey);
    if (!matches) continue;

    for (const m of matches) {
      const account = accountById.get(m.userId);
      const player = playerById.get(m.playerId);
      if (!account || !player) continue;
      if (usedAccounts.has(m.userId) || usedPlayers.has(m.playerId)) continue;
      usedAccounts.add(m.userId);
      usedPlayers.add(m.playerId);
      out.push({ userId: account.userId, discordName: account.discordName, discordImage: account.discordImage, playerId: player.playerId, playerDisplayName: player.displayName });
    }
  }
  return out;
}
