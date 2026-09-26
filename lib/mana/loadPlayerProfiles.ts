/**
 * Rellena `players.country` desde la ficha del jugador en Mana Games (`OT_Player.php`),
 * no desde el ranking — pedido del propietario, 2026-09-26. El ranking no trae país para
 * quien nunca ha estado en él (jugadores añadidos desde un torneo o un MatchLog) y lo
 * entrega roto cuando el texto no es latino ("ÎÎÎÎÎÎ" en vez de "ΕΛΛΑΔΑ"); la ficha lo da
 * bien y para todos.
 *
 * Es ADITIVO y acotado, como el resto de importadores: cada pasada lee como mucho `limit`
 * fichas (una petición cada `delayMs`, CLAUDE.md §5 — el foro no es nuestro), empezando
 * por quien no tiene país y nunca se ha leído, luego el resto sin leer, y por último las
 * fichas más antiguas (refresco lento, cada 60 días). Nunca borra un país ya guardado:
 * una ficha con el campo vacío solo marca `profile_checked_at` para no repetirla a diario.
 */
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { importRuns, playerAliases, players } from "@/db/schema";
import { parsePlayerProfilePage } from "@/parsers/playerProfilePage";
import { getCountryCode } from "@/lib/countryCodes";
import { ensureSource } from "./loaders";

const STALE_AFTER_DAYS = 60;
/** Fallos seguidos tras los que se corta la pasada — si el challenge anti-bot reaparece,
 * cada petición espera minutos antes de fallar, y no tiene sentido insistir. */
const MAX_CONSECUTIVE_FAILURES = 2;

export interface LoadPlayerProfilesResult {
  checked: number;
  countriesSet: number;
  failed: number;
}

interface Candidate {
  playerId: number;
  externalId: string;
}

/** Orden de lectura, en TypeScript y no en SQL: "país desconocido" es lo que NO resuelve a
 * ninguna bandera (`getCountryCode`), y eso incluye texto suelto como "SEA" o el texto
 * roto del ranking — un simple `country IS NULL` se los saltaba. Son unos cientos de
 * filas, de sobra para traerlas todas. */
async function findCandidates(sourceId: number, limit: number): Promise<Candidate[]> {
  const rows = await db
    .select({
      playerId: players.id,
      externalId: playerAliases.externalId,
      country: players.country,
      countryOverride: players.countryOverride,
      checkedAt: players.profileCheckedAt,
    })
    .from(players)
    .innerJoin(playerAliases, and(eq(playerAliases.playerId, players.id), eq(playerAliases.sourceId, sourceId)))
    .where(
      or(isNull(players.profileCheckedAt), lt(players.profileCheckedAt, sql`now() - make_interval(days => ${STALE_AFTER_DAYS})`)),
    );

  const rank = (r: (typeof rows)[number]) => [
    r.checkedAt !== null ? 1 : 0, // nunca leídas primero
    getCountryCode(r.countryOverride ?? r.country) !== null ? 1 : 0, // sin país que resuelva primero
    r.checkedAt?.getTime() ?? 0, // las más antiguas primero
    -r.playerId, // los jugadores más nuevos primero
  ];
  rows.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let k = 0; k < ra.length; k++) if (ra[k] !== rb[k]) return ra[k] - rb[k];
    return 0;
  });
  return rows.slice(0, limit).map((r) => ({ playerId: r.playerId, externalId: r.externalId }));
}

export async function refreshPlayerProfiles(options: {
  limit: number;
  headless?: boolean;
  delayMs?: number;
}): Promise<LoadPlayerProfilesResult> {
  const sourceId = await ensureSource();
  const startedAt = new Date();
  const delayMs = options.delayMs ?? 8_000;

  const candidates = await findCandidates(sourceId, options.limit);
  const result: LoadPlayerProfilesResult = { checked: 0, countriesSet: 0, failed: 0 };
  if (candidates.length === 0) return result;

  // Import perezoso a propósito — mismo motivo que loadRecentResults.ts: que `playwright`
  // no se cargue solo por importar esta función.
  const { fetchPlayerProfilePageLive } = await import("./fetchLive");
  const errors: { file: string; message: string }[] = [];
  let consecutiveFailures = 0;

  for (const [index, candidate] of candidates.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const { html } = await fetchPlayerProfilePageLive(candidate.externalId, options.headless);
      const profile = parsePlayerProfilePage(html);
      // Una redirección o una página equivocada nunca debe escribir el país de OTRO jugador.
      if (profile.externalId !== candidate.externalId) {
        throw new Error(`Profile id mismatch: asked for ${candidate.externalId}, got ${profile.externalId}`);
      }

      await db
        .update(players)
        .set(profile.country ? { country: profile.country, profileCheckedAt: new Date() } : { profileCheckedAt: new Date() })
        .where(eq(players.id, candidate.playerId));

      result.checked++;
      if (profile.country) result.countriesSet++;
      consecutiveFailures = 0;
    } catch (err) {
      result.failed++;
      consecutiveFailures++;
      errors.push({ file: `OT_Player.php?p=${candidate.externalId}`, message: err instanceof Error ? err.message : String(err) });
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;
    }
  }

  await db.insert(importRuns).values({
    sourceId,
    kind: "profiles",
    startedAt,
    finishedAt: new Date(),
    status: result.failed === 0 ? "success" : result.checked > 0 ? "partial" : "failed",
    filesProcessed: result.checked,
    rowsInserted: result.countriesSet,
    rowsSkipped: result.checked - result.countriesSet,
    ...(errors.length > 0 ? { errors } : {}),
  });

  return result;
}
