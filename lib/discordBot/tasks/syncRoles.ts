/**
 * Roles de logro del servidor, asignados solo a partir de resultados reales ya
 * importados — nunca a mano. Cinco familias, con reglas de vida distintas:
 *
 * - "World No. 1" y "Master Predictor" son roles de ESTADO con UN titular a la vez:
 *   solo los lleva quien está #1 ahora mismo (pedido explícito del propietario) — se
 *   le quita a quien lo tuviera antes y se le da al nuevo #1, cada vez que cambia.
 * - Los 7 de campeón ("Grand Slam Champion", "500 Champion"...) Y los 3 del minijuego
 *   de predicciones ("Believer", "Prophet", "Perfect Bracket") son logros PERMANENTES:
 *   una vez ganado, el rol nunca se quita, aunque el propietario no vuelva a ganar
 *   nada. Cada nivel es independiente — un jugador con un Grand Slam Y un 250 se queda
 *   con los dos roles, no solo el más alto.
 * - "Starter" es TEMPORAL con caducidad fija (concedido en
 *   `guildMemberAdd.ts` al unirse, 17 días, pedido explícito del propietario,
 *   2026-09-19) — `expireTemporaryRoleGrants` de abajo es lo único que lo quita,
 *   nunca esta familia de arriba.
 * - "Articles Writer" es de ESTADO con VARIOS titulares a la vez: sigue a
 *   `authUsers.isReporter`, se da y se quita según ese permiso cambie (pedido
 *   explícito del propietario, 2026-09-20 — revocar el permiso de reportero tiene
 *   que quitar el rol también).
 *
 * A propósito, esto NUNCA hace un `guild.members.fetch()` a secas (sin argumento) —
 * eso pediría el intent privilegiado "Server Members Intent" del Developer Portal
 * (activarlo o no es decisión del propietario, no de este código) porque cachea el
 * servidor entero. En su lugar se pide cada miembro por su ID de Discord conocido de
 * antemano (`guild.members.fetch(id)`), una llamada REST normal que no necesita ese
 * intent — el precio es que nunca se detecta a alguien con un rol de logro que no
 * debería tener (no pasa nada: nunca se los quitamos de todas formas, salvo en las
 * familias de estado, donde el "titular anterior" sale de una tabla propia, nunca
 * de preguntarle a Discord quién lo tiene ahora mismo). Para "World No. 1" sale del
 * propio histórico de `ranking_snapshots`; para "Master Predictor" (que se
 * recalcula en caliente, sin histórico propio) sale de `liveRoleHolders`; para
 * "Articles Writer" (varios titulares a la vez, no uno) sale de
 * `discordRoleMembers`; para "Starter" la fecha de caducidad sale de
 * `discordTemporaryRoleGrants` — ver el comentario de cada tabla en db/schema.ts.
 *
 * Con el/los rol(es) de `lib/discordBot/roleConfig.ts` sin configurar todavía, cada
 * parte se salta en silencio (con un aviso en el log) — nunca debe tirar abajo el
 * resto del ciclo de sondeo (anuncios, recordatorios).
 */
import { and, desc, eq, lte } from "drizzle-orm";
import type { Guild } from "discord.js";
import { db } from "@/db/client";
import {
  authAccounts,
  authUsers,
  bracketPredictions,
  discordRoleMembers,
  discordTemporaryRoleGrants,
  editions,
  liveRoleHolders,
  matches,
  players,
  rankingSnapshots,
} from "@/db/schema";
import { buildBracketLayout, type BracketLayout } from "@/lib/bracket";
import { getGlobalPredictionLeaderboard } from "@/lib/predictions/queries";
import { extractMarqueePicks, getPlayerExitRound } from "@/lib/predictions/marqueePicks";
import { scorePrediction, type BracketPick } from "@/lib/predictions/scoring";
import { excludeQualifyingRounds, getBracketMatchesForEdition } from "@/lib/tournamentBracketData";
import type { TournamentBracketMatch } from "@/components/tournament/BracketColumns";
import { discordClient } from "../client";
import { discordBotConfig } from "../config";
import { discordRoleConfig } from "../roleConfig";

function roleKeyForCategory(category: string): keyof typeof discordRoleConfig | null {
  if (category === "Grand Slam") return "grandSlamChampion";
  if (category === "Tour Finals") return "tourFinalsChampion";
  if (category === "Masters 1000") return "masters1000Champion";
  if (category === "500") return "fiveHundredChampion";
  if (category === "250" || category === "m250") return "twoFiftyChampion";
  if (category.includes("CT") || category.includes("Challenger")) return "challengerChampion";
  if (category === "Future") return "futuresChampion";
  return null; // Next Gen Finals, Exhibition, cualquier otra — sin rol correspondiente
}

async function addRoleToMember(guild: Guild, discordUserId: string, roleId: string): Promise<void> {
  try {
    const member = await guild.members.fetch(discordUserId);
    if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
  } catch (err) {
    console.error(`✗ No se pudo dar el rol ${roleId} a ${discordUserId}:`, err);
  }
}

async function removeRoleFromMember(guild: Guild, discordUserId: string, roleId: string): Promise<void> {
  try {
    const member = await guild.members.fetch(discordUserId);
    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId);
  } catch (err) {
    console.error(`✗ No se pudo quitar el rol ${roleId} a ${discordUserId}:`, err);
  }
}

interface ChampionRow {
  discordUserId: string;
  category: string;
}

/** Toda final ganada por alguien con Discord vinculado — los INNER JOIN ya descartan
 * jugadores sin cuenta vinculada, no hace falta filtrarlo aparte. Histórico completo
 * (sin ventana de fecha: aquí no se anuncia nada, solo se asegura que el rol está
 * puesto) agrupado por ganador en vez de por torneo reciente. */
async function findChampions(): Promise<ChampionRow[]> {
  return db
    .select({
      discordUserId: authAccounts.providerAccountId,
      category: editions.category,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(players, eq(players.id, matches.winnerId))
    .innerJoin(authAccounts, and(eq(authAccounts.userId, players.linkedUserId), eq(authAccounts.provider, "discord")))
    .where(eq(matches.round, "F"));
}

async function syncChampionRoles(guild: Guild): Promise<void> {
  const rows = await findChampions();
  // Un jugador con varios títulos en la MISMA categoría (o en dos categorías que
  // caen en el mismo rol, "250"/"m250") sale una fila por título ganado — sin
  // deduplicar, se repetiría la misma llamada a la API de Discord una vez por título
  // de más (visto en real: 3 intentos idénticos para el mismo jugador+rol).
  const seen = new Set<string>();
  for (const row of rows) {
    const key = roleKeyForCategory(row.category);
    const roleId = key ? discordRoleConfig[key] : null;
    if (!roleId) continue;
    const dedupeKey = `${row.discordUserId}:${roleId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    await addRoleToMember(guild, row.discordUserId, roleId);
  }
}

interface WeekOneRow {
  isoYear: number;
  isoWeek: number;
  playerId: number;
  discordUserId: string | null;
}

/** Las dos semanas oficiales más recientes con un #1 — el ranking de Mana Games nunca
 * deja empates ni huecos de posición (confirmado contra semanas reales sin tocar,
 * ver docs/decisiones.md), así que hay exactamente una fila con rank=1 por semana. */
async function findLastTwoWeekOneHolders(): Promise<WeekOneRow[]> {
  return db
    .select({
      isoYear: rankingSnapshots.isoYear,
      isoWeek: rankingSnapshots.isoWeek,
      playerId: rankingSnapshots.playerId,
      discordUserId: authAccounts.providerAccountId,
    })
    .from(rankingSnapshots)
    .innerJoin(players, eq(players.id, rankingSnapshots.playerId))
    .leftJoin(authAccounts, and(eq(authAccounts.userId, players.linkedUserId), eq(authAccounts.provider, "discord")))
    .where(and(eq(rankingSnapshots.kind, "official"), eq(rankingSnapshots.rank, 1)))
    .orderBy(desc(rankingSnapshots.isoYear), desc(rankingSnapshots.isoWeek))
    .limit(2);
}

async function syncWorldNumberOne(guild: Guild): Promise<void> {
  const roleId = discordRoleConfig.worldNo1;
  if (!roleId) return;

  const [current, previous] = await findLastTwoWeekOneHolders();
  if (!current) return;

  if (previous && previous.discordUserId && previous.discordUserId !== current.discordUserId) {
    await removeRoleFromMember(guild, previous.discordUserId, roleId);
  }
  if (current.discordUserId) {
    await addRoleToMember(guild, current.discordUserId, roleId);
  }
}

/** Cualquier jugador con perfil reclamado y Discord vinculado — sin filtro por
 * partidos ni títulos, es una identidad de base, no un logro. Permanente, igual que
 * los roles de campeón: nunca se quita (desvincularse es un caso raro, decisión de
 * admin, no algo que este ciclo automático deba deshacer). */
async function findLinkedPlayers(): Promise<{ discordUserId: string }[]> {
  return db
    .select({ discordUserId: authAccounts.providerAccountId })
    .from(players)
    .innerJoin(authAccounts, and(eq(authAccounts.userId, players.linkedUserId), eq(authAccounts.provider, "discord")));
}

async function syncTourPlayerRole(guild: Guild): Promise<void> {
  const roleId = discordRoleConfig.tourPlayer;
  if (!roleId) return;

  const rows = await findLinkedPlayers();
  for (const row of rows) {
    await addRoleToMember(guild, row.discordUserId, roleId);
  }
}

/**
 * "Articles Writer" sigue a `authUsers.isReporter` — a diferencia de "Tour Player"
 * de arriba (identidad que en la práctica nunca se retira), este SÍ puede
 * revocarse desde /account (botón "Revoke" de la lista de reporteros), así que el
 * rol tiene que poder quitarse igual de fácil. `discord_role_members` guarda quién
 * lo tiene puesto AHORA MISMO según el último ciclo — comparando contra quién
 * DEBERÍA tenerlo ahora se ve exactamente a quién dárselo de nuevo y a quién
 * quitárselo, sin preguntarle nunca a Discord "quién lo tiene ya" (ver la cabecera
 * del fichero).
 */
async function syncArticlesWriterRole(guild: Guild): Promise<void> {
  const roleId = discordRoleConfig.articlesWriter;
  if (!roleId) return;

  const [currentRows, knownRows] = await Promise.all([
    db
      .select({ discordUserId: authAccounts.providerAccountId })
      .from(authUsers)
      .innerJoin(authAccounts, and(eq(authAccounts.userId, authUsers.id), eq(authAccounts.provider, "discord")))
      .where(eq(authUsers.isReporter, true)),
    db.select({ discordUserId: discordRoleMembers.discordUserId }).from(discordRoleMembers).where(eq(discordRoleMembers.roleKey, "articlesWriter")),
  ]);
  const currentIds = new Set(currentRows.map((r) => r.discordUserId));
  const knownIds = new Set(knownRows.map((r) => r.discordUserId));

  for (const discordUserId of currentIds) {
    if (knownIds.has(discordUserId)) continue;
    await addRoleToMember(guild, discordUserId, roleId);
    await db.insert(discordRoleMembers).values({ roleKey: "articlesWriter", discordUserId }).onConflictDoNothing();
  }
  for (const discordUserId of knownIds) {
    if (currentIds.has(discordUserId)) continue;
    await removeRoleFromMember(guild, discordUserId, roleId);
    await db.delete(discordRoleMembers).where(and(eq(discordRoleMembers.roleKey, "articlesWriter"), eq(discordRoleMembers.discordUserId, discordUserId)));
  }
}

async function discordIdForUser(userId: string): Promise<string | null> {
  const [account] = await db
    .select({ discordUserId: authAccounts.providerAccountId })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.provider, "discord")));
  return account?.discordUserId ?? null;
}

/** El #1 actual de `getGlobalPredictionLeaderboard()` (temporada en curso) — mismo
 * criterio que ya usa la página de clasificación de predictores. */
async function syncMasterPredictorRole(guild: Guild): Promise<void> {
  const roleId = discordRoleConfig.masterPredictor;
  if (!roleId) return;

  const [top] = await getGlobalPredictionLeaderboard();
  if (!top) return;
  const currentDiscordId = await discordIdForUser(top.userId);
  if (!currentDiscordId) return;

  const [previous] = await db.select().from(liveRoleHolders).where(eq(liveRoleHolders.roleKey, "masterPredictor"));
  if (previous && previous.discordUserId !== currentDiscordId) {
    await removeRoleFromMember(guild, previous.discordUserId, roleId);
  }
  await addRoleToMember(guild, currentDiscordId, roleId);
  await db
    .insert(liveRoleHolders)
    .values({ roleKey: "masterPredictor", discordUserId: currentDiscordId })
    .onConflictDoUpdate({ target: liveRoleHolders.roleKey, set: { discordUserId: currentDiscordId, updatedAt: new Date() } });
}

interface CompletedEditionPredictionContext {
  year: number;
  isoWeek: number | null;
  layout: BracketLayout<TournamentBracketMatch>;
  seedByPlayerId: Map<number, number | null>;
  predictions: { userId: string; picks: BracketPick[] }[];
}

/** Toda edición con una final ya decidida — histórico completo, sin ventana de fecha
 * (mismo criterio que `findChampions` de arriba: aquí no se anuncia nada, solo se
 * comprueba que el rol está puesto). */
async function findCompletedEditionIds(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ id: editions.id })
    .from(editions)
    .innerJoin(matches, and(eq(matches.editionId, editions.id), eq(matches.round, "F")));
  return rows.map((r) => r.id);
}

function seedByPlayerId(allMatches: TournamentBracketMatch[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const m of allMatches) {
    if (!map.has(m.player1.id)) map.set(m.player1.id, m.player1.seed);
    if (!map.has(m.player2.id)) map.set(m.player2.id, m.player2.seed);
  }
  return map;
}

function isUnseededPick(seedById: Map<number, number | null>, playerId: number | null): boolean {
  if (playerId === null) return false;
  const seed = seedById.get(playerId);
  return seed === null || seed === undefined;
}

/** Un `getBracketMatchesForEdition` + `buildBracketLayout` por edición completa,
 * calculado UNA sola vez y compartido entre las tres comprobaciones de logros de
 * predicción de abajo (Believer/Prophet/Perfect Bracket) — mismo criterio que ya usa
 * `getPredictionLeaderboard` dentro de una sola edición, aquí a través de todo el
 * histórico. Se salta cualquier edición sin ninguna entrega guardada. */
async function collectCompletedEditionContexts(): Promise<CompletedEditionPredictionContext[]> {
  const editionIds = await findCompletedEditionIds();
  const contexts: CompletedEditionPredictionContext[] = [];

  for (const editionId of editionIds) {
    const predictions = await db
      .select({ userId: bracketPredictions.userId, picks: bracketPredictions.picks })
      .from(bracketPredictions)
      .where(eq(bracketPredictions.editionId, editionId));
    if (predictions.length === 0) continue;

    const [edition] = await db.select({ year: editions.year, isoWeek: editions.isoWeek }).from(editions).where(eq(editions.id, editionId));
    if (!edition) continue;

    const allMatches = excludeQualifyingRounds(await getBracketMatchesForEdition(editionId));
    contexts.push({
      year: edition.year,
      isoWeek: edition.isoWeek,
      layout: buildBracketLayout(allMatches),
      seedByPlayerId: seedByPlayerId(allMatches),
      predictions,
    });
  }
  return contexts;
}

/** Acertó campeón o finalista con un pick SIN cabeza de serie en el cuadro real
 * (`seed === null`) — pedido explícito del propietario (2026-09-19): premia
 * atreverse con un "underdog", no solo acertar. */
async function findBelieverDiscordIds(contexts: CompletedEditionPredictionContext[]): Promise<string[]> {
  const discordIds = new Set<string>();
  for (const ctx of contexts) {
    const lastRound = ctx.layout.roundOrder[ctx.layout.roundOrder.length - 1];
    for (const p of ctx.predictions) {
      const marquee = extractMarqueePicks(p.picks, ctx.layout);

      const championExit = getPlayerExitRound(ctx.layout, marquee.championId);
      const championHit = championExit?.kind === "champion" && isUnseededPick(ctx.seedByPlayerId, marquee.championId);

      const finalistExit = getPlayerExitRound(ctx.layout, marquee.finalistId);
      const finalistHit =
        finalistExit?.kind === "eliminated" && finalistExit.round === lastRound && isUnseededPick(ctx.seedByPlayerId, marquee.finalistId);

      if (!championHit && !finalistHit) continue;
      const discordId = await discordIdForUser(p.userId);
      if (discordId) discordIds.add(discordId);
    }
  }
  return [...discordIds];
}

const PROPHET_STREAK_LENGTH = 3;

interface ChampionPickResult {
  year: number;
  isoWeek: number | null;
  userId: string;
  correct: boolean;
}

/** 3 campeones acertados SEGUIDOS entre las entregas que de verdad envió cada
 * usuario — no 3 torneos seguidos del calendario: si se salta uno, la racha sigue
 * contando desde la siguiente entrega real. Pedido explícito del propietario
 * (2026-09-19). */
async function findProphetDiscordIds(contexts: CompletedEditionPredictionContext[]): Promise<string[]> {
  const results: ChampionPickResult[] = [];
  for (const ctx of contexts) {
    for (const p of ctx.predictions) {
      const marquee = extractMarqueePicks(p.picks, ctx.layout);
      const exit = getPlayerExitRound(ctx.layout, marquee.championId);
      results.push({ year: ctx.year, isoWeek: ctx.isoWeek, userId: p.userId, correct: exit?.kind === "champion" });
    }
  }

  const byUser = new Map<string, ChampionPickResult[]>();
  for (const r of results) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }

  const discordIds = new Set<string>();
  for (const [userId, list] of byUser) {
    list.sort((a, b) => a.year - b.year || (a.isoWeek ?? 0) - (b.isoWeek ?? 0));
    let streak = 0;
    let achieved = false;
    for (const r of list) {
      streak = r.correct ? streak + 1 : 0;
      if (streak >= PROPHET_STREAK_LENGTH) {
        achieved = true;
        break;
      }
    }
    if (!achieved) continue;
    const discordId = await discordIdForUser(userId);
    if (discordId) discordIds.add(discordId);
  }
  return [...discordIds];
}

/** Acertó los CUATRO huecos de cartel de un torneo entero de una sentada — cada ronda
 * del cuadro con el 100% de los aciertos posibles (`correct === possible`, y al menos
 * un hueco decidido en cada una). Nunca "llegó lejos": basta con fallar un solo hueco
 * ya decidido para no contar. */
async function findPerfectBracketDiscordIds(contexts: CompletedEditionPredictionContext[]): Promise<string[]> {
  const discordIds = new Set<string>();
  for (const ctx of contexts) {
    for (const p of ctx.predictions) {
      const score = scorePrediction(p.picks, ctx.layout);
      const isPerfect = score.byRound.length > 0 && score.byRound.every((r) => r.possible > 0 && r.correct === r.possible);
      if (!isPerfect) continue;
      const discordId = await discordIdForUser(p.userId);
      if (discordId) discordIds.add(discordId);
    }
  }
  return [...discordIds];
}

async function syncPredictionAchievementRoles(guild: Guild): Promise<void> {
  if (!discordRoleConfig.believer && !discordRoleConfig.prophet && !discordRoleConfig.perfectBracket) return;

  const contexts = await collectCompletedEditionContexts();

  if (discordRoleConfig.believer) {
    for (const id of await findBelieverDiscordIds(contexts)) await addRoleToMember(guild, id, discordRoleConfig.believer);
  }
  if (discordRoleConfig.prophet) {
    for (const id of await findProphetDiscordIds(contexts)) await addRoleToMember(guild, id, discordRoleConfig.prophet);
  }
  if (discordRoleConfig.perfectBracket) {
    for (const id of await findPerfectBracketDiscordIds(contexts)) await addRoleToMember(guild, id, discordRoleConfig.perfectBracket);
  }
}

/** Mapa de `roleKey` (texto libre guardado en `discord_temporary_role_grants`) al
 * campo real de `discordRoleConfig` — nunca se castea el texto de la fila
 * directamente como clave del config, mismo criterio que `roleKeyForCategory` de
 * arriba. Añadir un nuevo rol temporal aquí cuando haga falta, no solo en el sitio
 * que lo concede. */
function temporaryRoleConfigKey(roleKey: string): keyof typeof discordRoleConfig | null {
  return roleKey === "starter" ? "starter" : null;
}

/** Roles temporales con caducidad conocida de antemano (ver el comentario de
 * `discordTemporaryRoleGrants` en db/schema.ts) — quita el rol y borra la fila en
 * cuanto se cumple `expiresAt`. A diferencia de los roles de logro/estado de arriba,
 * aquí SÍ hay que borrar la fila una vez procesada: si no, se intentaría quitar el
 * mismo rol al mismo miembro otra vez en cada ciclo siguiente para siempre. */
async function expireTemporaryRoleGrants(guild: Guild): Promise<void> {
  const expired = await db.select().from(discordTemporaryRoleGrants).where(lte(discordTemporaryRoleGrants.expiresAt, new Date()));
  for (const row of expired) {
    const configKey = temporaryRoleConfigKey(row.roleKey);
    const roleId = configKey ? discordRoleConfig[configKey] : null;
    if (roleId) await removeRoleFromMember(guild, row.discordUserId, roleId);
    await db.delete(discordTemporaryRoleGrants).where(eq(discordTemporaryRoleGrants.id, row.id));
  }
}

export async function syncRoles(): Promise<void> {
  const guild = await discordClient.guilds.fetch(discordBotConfig.guildId);

  try {
    await syncTourPlayerRole(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando el rol de Tour Player:", err);
  }

  try {
    await syncArticlesWriterRole(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando el rol de Articles Writer:", err);
  }

  try {
    await syncWorldNumberOne(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando el rol de World No. 1:", err);
  }

  try {
    await syncChampionRoles(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando los roles de campeón:", err);
  }

  try {
    await syncMasterPredictorRole(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando el rol de Master Predictor:", err);
  }

  try {
    await syncPredictionAchievementRoles(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando los roles de logro de predicciones:", err);
  }

  try {
    await expireTemporaryRoleGrants(guild);
  } catch (err) {
    console.error("✗ Fallo expirando roles temporales:", err);
  }
}
