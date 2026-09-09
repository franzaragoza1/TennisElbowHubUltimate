"use server";

import { and, eq, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { awardNominations, awardPeriods, editions, events, matches, players, recentResults } from "@/db/schema";
import { requireAdmin } from "@/lib/adminSession";
import { categoriesForCycle, getAwardCategory, isAwardCategoryKey } from "@/lib/awards/catalog";
import { getAwardPeriod, getNominationsForPeriod, periodDateFilter, recentResultsJoinCondition, type AwardPeriodRow, type NominationDisplay } from "@/lib/awards/queries";
import { fetchGuildRoles, type DiscordRoleOption } from "@/lib/discordBot/guildRoles";
import { endDiscordPollEarly } from "@/lib/discordBot/pollRest";
import { syncOnePeriodPollResults } from "@/lib/discordBot/tasks/syncAwardsPollResults";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richText";
import type { MatchCandidateOption } from "@/app/admin/videos/actions";

// Mínimo de nominados aprobados para que una categoría tenga sentido en la votación —
// con uno solo no hay elección real que hacer. Una categoría con CERO nominados
// aprobados simplemente se omite de esa edición (p.ej. Point of the Month antes de que
// Google Drive esté configurado, ver Fase 2/4 del plan) en vez de bloquear todo el
// período: solo las categorías que SÍ tienen algún nominado deben llegar al mínimo.
const MIN_NOMINEES_PER_ACTIVE_CATEGORY = 2;

export interface CreateAwardPeriodOutcome {
  error: string | null;
  periodId: number | null;
}

/** Para el desplegable de menciones del editor del discurso — ver
 * components/admin/RichTextEditor.tsx y lib/discordBot/guildRoles.ts. */
export async function listDiscordRoleOptions(): Promise<DiscordRoleOption[]> {
  await requireAdmin();
  return fetchGuildRoles();
}

export async function createAwardPeriod(formData: FormData): Promise<CreateAwardPeriodOutcome> {
  await requireAdmin();

  const cycle = String(formData.get("cycle") ?? "");
  const year = Number(formData.get("year"));
  const monthRaw = String(formData.get("month") ?? "").trim();
  const month = monthRaw ? Number(monthRaw) : null;

  if (!["monthly", "yearly"].includes(cycle) || !Number.isInteger(year)) {
    return { error: "Fill in every field.", periodId: null };
  }
  if (cycle === "monthly" && (!Number.isInteger(month) || month! < 1 || month! > 12)) {
    return { error: "Pick a month for a monthly awards period.", periodId: null };
  }

  // Sin unique(cycle, year, month) en el esquema (month es null en TODAS las filas
  // anuales, ver db/schema.ts) — el duplicado se comprueba aquí, mismo criterio que
  // playerClaimRequests para "una sola solicitud pendiente".
  const existing = await db
    .select({ id: awardPeriods.id })
    .from(awardPeriods)
    .where(cycle === "monthly" ? and(eq(awardPeriods.cycle, cycle), eq(awardPeriods.year, year), eq(awardPeriods.month, month!)) : and(eq(awardPeriods.cycle, cycle), eq(awardPeriods.year, year)));
  if (existing.length > 0) {
    return { error: `A ${cycle} awards period for ${cycle === "monthly" ? `${month}/${year}` : year} already exists.`, periodId: null };
  }

  const [period] = await db.insert(awardPeriods).values({ cycle, year, month, status: "draft" }).returning({ id: awardPeriods.id });

  revalidatePath("/account");
  return { error: null, periodId: period.id };
}

/** Borra un período de premios entero — nominaciones y votos se van solos por
 * cascada desde award_periods (ver db/schema.ts). Pensado sobre todo para limpiar
 * períodos de prueba mientras se prueba el flujo, igual que
 * DeleteFinalsEditionButton hace con una edición de Finals. */
export async function deleteAwardPeriod(formData: FormData): Promise<void> {
  await requireAdmin();
  const periodId = Number(formData.get("periodId"));
  if (!Number.isInteger(periodId)) return;

  await db.delete(awardPeriods).where(eq(awardPeriods.id, periodId));

  revalidatePath("/account");
  revalidatePath("/awards");
}

/** Partidos jugados DENTRO del período que se está curando — nunca el histórico
 * entero (a diferencia de searchMatchCandidates en app/admin/videos/actions.ts, que
 * busca en toda la base para emparejar un VOD de cualquier fecha). El filtro de fecha
 * en sí vive en lib/awards/queries.ts::periodDateFilter (compartido con el buscador
 * del propio jugador en app/awards/actions.ts::searchMyMatchCandidates). */
export async function searchMatchCandidatesForPeriod(periodId: number, query: string): Promise<MatchCandidateOption[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const period = await getAwardPeriod(periodId);
  if (!period) return [];

  const p1 = alias(players, "award_search_p1");
  const p2 = alias(players, "award_search_p2");
  const like = `%${q}%`;

  // LEFT JOIN, no INNER: un partido sin fila en recent_results tiene que seguir
  // pudiendo aparecer (cae al fallback de periodDateFilter), no desaparecer de la
  // búsqueda. Un mismo partido puede tener más de una fila en recent_results (se
  // reportó dos veces a horas distintas, ver announceResults.ts) — se pide margen y se
  // deduplica en JS por id de partido, mismo criterio que esa misma tarea.
  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      player1: p1.displayName,
      player2: p2.displayName,
      eventName: events.displayName,
      year: editions.year,
    })
    .from(matches)
    .innerJoin(editions, eq(matches.editionId, editions.id))
    .innerJoin(events, eq(editions.eventId, events.id))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .leftJoin(recentResults, recentResultsJoinCondition())
    .where(and(periodDateFilter(period), or(ilike(p1.displayName, like), ilike(p2.displayName, like), ilike(events.displayName, like))))
    .limit(24);

  const seen = new Set<number>();
  const deduped = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, 8);

  return deduped.map((r) => ({ id: r.id, label: `${r.player1} vs ${r.player2} — ${r.eventName} ${r.year} (${r.round})` }));
}

export interface NominationOutcome {
  error: string | null;
}

/**
 * Añade un nominado directamente aprobado — nunca para 'point_of_month', la única
 * categoría con envío público de clip (app/awards/actions.ts::submitPointOfMonthClip);
 * un admin nunca toca el flujo de subida a Drive.
 */
export async function addAdminNomination(formData: FormData): Promise<NominationOutcome> {
  await requireAdmin();

  const periodId = Number(formData.get("periodId"));
  const categoryKey = String(formData.get("categoryKey") ?? "");
  const playerIdRaw = String(formData.get("playerId") ?? "").trim();
  const matchIdRaw = String(formData.get("matchId") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const playerId = playerIdRaw ? Number(playerIdRaw) : null;
  const matchId = matchIdRaw ? Number(matchIdRaw) : null;

  if (!Number.isInteger(periodId)) return { error: "Invalid period." };
  if (!isAwardCategoryKey(categoryKey)) return { error: "Invalid category." };
  if (categoryKey === "point_of_month") return { error: "Point of the Month only accepts player submissions, not admin nominees." };

  const category = getAwardCategory(categoryKey)!;
  const period = await getAwardPeriod(periodId);
  if (!period) return { error: "Period not found." };
  if (period.status !== "draft") return { error: "Nominees can only be added while the period is still a draft." };
  if (category.cycle !== period.cycle) return { error: `${category.label} isn't a ${period.cycle} category.` };

  if (category.nomineeKind === "player" && !playerId) return { error: "Pick a player." };
  if (category.nomineeKind === "match" && !matchId) return { error: "Pick a match." };
  if (category.nomineeKind === "player_in_match" && (!playerId || !matchId)) return { error: "Pick both a player and a match." };

  await db.insert(awardNominations).values({
    periodId,
    categoryKey,
    playerId: category.nomineeKind === "match" ? null : playerId,
    matchId: category.nomineeKind === "player" ? null : matchId,
    caption,
    status: "approved",
    submittedByUserId: null,
  });

  revalidatePath("/account");
  return { error: null };
}

export async function removeNomination(formData: FormData): Promise<NominationOutcome> {
  await requireAdmin();
  const nominationId = Number(formData.get("nominationId"));
  if (!Number.isInteger(nominationId)) return { error: "Invalid nominee." };

  const [nomination] = await db.select({ periodId: awardNominations.periodId }).from(awardNominations).where(eq(awardNominations.id, nominationId));
  if (!nomination) return { error: "Nominee not found." };

  const period = await getAwardPeriod(nomination.periodId);
  if (period?.status !== "draft") return { error: "Nominees can only be removed while the period is still a draft." };

  await db.delete(awardNominations).where(eq(awardNominations.id, nominationId));

  revalidatePath("/account");
  return { error: null };
}

/**
 * Aprueba un envío pendiente de Point of the Month — la ÚNICA categoría con envío
 * público de clip (app/awards/actions.ts::submitPointOfMonthClip nace en 'pending').
 * Sin límite de estado del período a propósito: un envío puede llegar, o quedarse sin
 * revisar, incluso después de abrir la votación (bug real reportado, "point of the
 * month poll didn't get sent after opening votes" — esta acción de aprobar/rechazar
 * no existía en absoluto, así que dos envíos llevaban pendientes desde antes de abrir
 * y esa categoría se publicó sin nominados). announceAwardsVotingOpened.ts vuelve a
 * comprobar cada categoría de un período ya en 'voting' en cada ciclo del bot y
 * publica el sondeo que falte en cuanto haya algo aprobado, así que aprobar aquí
 * DESPUÉS de abrir la votación sí llega a publicarse.
 */
export async function approvePendingSubmission(formData: FormData): Promise<NominationOutcome> {
  await requireAdmin();
  const nominationId = Number(formData.get("nominationId"));
  if (!Number.isInteger(nominationId)) return { error: "Invalid submission." };

  const [nomination] = await db.select({ status: awardNominations.status }).from(awardNominations).where(eq(awardNominations.id, nominationId));
  if (!nomination) return { error: "Submission not found." };
  if (nomination.status !== "pending") return { error: "This submission was already reviewed." };

  await db.update(awardNominations).set({ status: "approved" }).where(eq(awardNominations.id, nominationId));

  revalidatePath("/account");
  return { error: null };
}

export async function rejectPendingSubmission(formData: FormData): Promise<NominationOutcome> {
  await requireAdmin();
  const nominationId = Number(formData.get("nominationId"));
  if (!Number.isInteger(nominationId)) return { error: "Invalid submission." };

  await db
    .update(awardNominations)
    .set({ status: "rejected" })
    .where(and(eq(awardNominations.id, nominationId), eq(awardNominations.status, "pending")));

  revalidatePath("/account");
  return { error: null };
}

export async function updateAwardPeriodSpeech(formData: FormData): Promise<void> {
  await requireAdmin();
  const periodId = Number(formData.get("periodId"));
  const speech = sanitizeRichText(String(formData.get("speech") ?? ""));
  if (!Number.isInteger(periodId)) return;

  await db.update(awardPeriods).set({ speech }).where(eq(awardPeriods.id, periodId));
  revalidatePath("/account");
  revalidatePath("/awards");
  revalidatePath(`/awards/${periodId}`);
}

export interface OpenVotingOutcome {
  error: string | null;
}

export async function openVoting(formData: FormData): Promise<OpenVotingOutcome> {
  await requireAdmin();
  const periodId = Number(formData.get("periodId"));
  if (!Number.isInteger(periodId)) return { error: "Invalid period." };

  const period = await getAwardPeriod(periodId);
  if (!period) return { error: "Period not found." };
  if (period.status !== "draft") return { error: "This period has already been published." };
  if (!period.speech || isRichTextEmpty(period.speech)) return { error: "Write the announcement speech before opening voting." };

  const nominations = await getNominationsForPeriod(periodId, ["approved"]);
  const countByCategory = new Map<string, number>();
  for (const n of nominations) countByCategory.set(n.categoryKey, (countByCategory.get(n.categoryKey) ?? 0) + 1);
  if (countByCategory.size === 0) return { error: "Add at least one nominee before opening voting." };

  const short = categoriesForCycle(period.cycle as "monthly" | "yearly")
    .filter((c) => (countByCategory.get(c.key) ?? 0) > 0 && (countByCategory.get(c.key) ?? 0) < MIN_NOMINEES_PER_ACTIVE_CATEGORY)
    .map((c) => c.label);
  if (short.length > 0) return { error: `These categories need at least ${MIN_NOMINEES_PER_ACTIVE_CATEGORY} nominees each before opening voting: ${short.join(", ")}.` };

  await db.update(awardPeriods).set({ status: "voting", votingOpensAt: new Date() }).where(eq(awardPeriods.id, periodId));

  revalidatePath("/account");
  revalidatePath("/awards");
  return { error: null };
}

/**
 * Termina antes de tiempo el/los sondeo(s) de Discord de esta votación (REST puro, ver
 * lib/discordBot/pollRest.ts) y hace unos pocos intentos cortos de leer ya el
 * recuento final y cerrar el período — pedido explícito del propietario: "can't it
 * just do it once just after voting ends?". Terminar un sondeo no garantiza que
 * Discord ya tenga el recuento definitivo al instante (`is_finalized` puede tardar un
 * poco en ponerse a true), de ahí los reintentos con una pausa corta entre cada uno en
 * vez de un solo intento; si aun así no lo consigue, no pasa nada — el ciclo de cada
 * minuto del bot (scripts/discordBot.ts::runAwardsPollCycle) lo recoge solo la próxima
 * vez, sin que el admin tenga que hacer nada más. Ese mismo ciclo periódico sigue
 * siendo el único mecanismo para un sondeo que expira SOLO (nadie pulsa este botón):
 * ahí no hay ningún momento propio al que engancharse, así que no puede hacerse "una
 * sola vez justo después" — no hay un "después" que nosotros controlemos.
 */
export async function closeVoting(formData: FormData): Promise<OpenVotingOutcome> {
  await requireAdmin();
  const periodId = Number(formData.get("periodId"));
  if (!Number.isInteger(periodId)) return { error: "Invalid period." };

  const period = await getAwardPeriod(periodId);
  if (!period) return { error: "Period not found." };
  if (period.status !== "voting") return { error: "This period isn't open for voting." };

  const nominations = await getNominationsForPeriod(periodId, ["approved"]);
  const messageIds = [...new Set(nominations.map((n) => n.discordPollMessageId).filter((id): id is string => id !== null))];
  if (messageIds.length === 0) return { error: "The Discord poll hasn't been posted yet — try again in a minute." };

  const channelId = process.env.DISCORD_AWARDS_CHANNEL_ID;
  if (!channelId) return { error: "DISCORD_AWARDS_CHANNEL_ID isn't configured." };

  const outcomes = await Promise.allSettled(messageIds.map((messageId) => endDiscordPollEarly(channelId, messageId)));
  const failed = outcomes.filter((o) => o.status === "rejected");
  if (failed.length === messageIds.length) return { error: "Couldn't reach Discord to end the poll(s) — try again shortly." };

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await syncOnePeriodPollResults(periodId)) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  revalidatePath("/account");
  revalidatePath("/awards");
  revalidatePath(`/awards/${periodId}`);
  return { error: null };
}

export interface AwardPeriodDetail extends AwardPeriodRow {
  nominationsByCategory: Record<string, (NominationDisplay & { voteCount: number })[]>;
}

/** Toda la ficha de un período de una vez, bajo demanda — mismo patrón que
 * getFinalsEditionDetail (app/admin/finals/actions.ts): pedida en useEffect desde
 * components/admin/sections/AwardsSection.tsx y otra vez tras cada mutación. El admin
 * ve TODOS los estados (pending/approved/rejected) y los recuentos de voto SIEMPRE,
 * aunque el período siga en votación — a diferencia de la página pública. */
export async function getAwardPeriodDetail(periodId: number): Promise<AwardPeriodDetail | null> {
  await requireAdmin();
  if (!Number.isInteger(periodId)) return null;

  const period = await getAwardPeriod(periodId);
  if (!period) return null;

  const nominations = await getNominationsForPeriod(periodId);
  const nominationsByCategory: AwardPeriodDetail["nominationsByCategory"] = {};
  for (const n of nominations) {
    (nominationsByCategory[n.categoryKey] ??= []).push({ ...n, voteCount: n.manualVoteCount ?? 0 });
  }

  return { ...period, nominationsByCategory };
}
