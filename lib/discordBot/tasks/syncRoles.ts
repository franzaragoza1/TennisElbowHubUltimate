/**
 * Roles de logro del servidor, asignados solo a partir de resultados reales ya
 * importados — nunca a mano. Dos familias, con reglas de vida distintas:
 *
 * - "World No. 1" es un rol de ESTADO, no de logro: solo lo lleva quien está #1 ahora
 *   mismo (pedido explícito del propietario) — se le quita a quien lo tuviera la
 *   semana anterior y se le da al nuevo #1, cada vez que cambia.
 * - Los otros 7 ("Grand Slam Champion", "500 Champion"...) son logros PERMANENTES:
 *   una vez ganado un título en esa categoría, el rol nunca se quita, aunque el
 *   propietario no vuelva a ganar nada. Cada nivel es independiente — un jugador con
 *   un Grand Slam Y un 250 se queda con los dos roles, no solo el más alto.
 *
 * A propósito, esto NUNCA hace un `guild.members.fetch()` a secas (sin argumento) —
 * eso pediría el intent privilegiado "Server Members Intent" del Developer Portal
 * (activarlo o no es decisión del propietario, no de este código) porque cachea el
 * servidor entero. En su lugar se pide cada miembro por su ID de Discord conocido de
 * antemano (`guild.members.fetch(id)`), una llamada REST normal que no necesita ese
 * intent — el precio es que nunca se detecta a alguien con un rol de logro que no
 * debería tener (no pasa nada: nunca se los quitamos de todas formas), y para "World
 * No. 1" el "titular anterior" sale del propio histórico de `ranking_snapshots`, no
 * de preguntarle a Discord quién lo tiene ahora mismo.
 *
 * Con el/los rol(es) de `lib/discordBot/roleConfig.ts` sin configurar todavía, cada
 * parte se salta en silencio (con un aviso en el log) — nunca debe tirar abajo el
 * resto del ciclo de sondeo (anuncios, recordatorios).
 */
import { and, desc, eq } from "drizzle-orm";
import type { Guild } from "discord.js";
import { db } from "@/db/client";
import { authAccounts, editions, matches, players, rankingSnapshots } from "@/db/schema";
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
 * jugadores sin cuenta vinculada, no hace falta filtrarlo aparte. Mismo camino de
 * tablas que lib/newsGeneration/facts.ts::detectChampions, pero histórico completo
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

export async function syncRoles(): Promise<void> {
  const guild = await discordClient.guilds.fetch(discordBotConfig.guildId);

  try {
    await syncTourPlayerRole(guild);
  } catch (err) {
    console.error("✗ Fallo sincronizando el rol de Tour Player:", err);
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
}
