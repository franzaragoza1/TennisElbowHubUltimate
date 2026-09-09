"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { awardNominations, awardPeriods, editions, events, matches, players, recentResults } from "@/db/schema";
import { getLinkedPlayerId, requireUser } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { periodDateFilter, recentResultsJoinCondition } from "@/lib/awards/queries";
import type { MatchCandidateOption } from "@/app/admin/videos/actions";

// --- Point of the Month: envío de clip por el propio jugador ---
//
// La ÚNICA categoría con envío público (lib/awards/catalog.ts) — todas las demás las
// añade un admin directamente, ya aprobadas (app/admin/awards/actions.ts::
// addAdminNomination rechaza explícitamente 'point_of_month'). El jugador pega un
// enlace ya alojado en otro sitio (YouTube, Drive, donde sea) — nunca alojamos el
// vídeo nosotros. Se intentó primero una subida real a través de la web hacia Google
// Drive (protocolo resumable, subida en trozos vía un proxy propio para esquivar el
// límite de payload de una función de Vercel) y se abandonó del todo: Drive no manda
// `Access-Control-Allow-Origin` en su endpoint de subida (confirmado con una petición
// real), así que ni siquiera la subida directa desde el navegador era viable sin ese
// proxy — y aun con el proxy funcionando de verdad (probado contra Drive real), se
// pidió explícitamente no seguir por ahí ("let users just upload a link, whether its
// youtube or google drive or whatever, this was useless work").

const MAX_PENDING_SUBMISSIONS_PER_PERIOD = 3;
const MAX_CLIP_URL_LENGTH = 2000;

export interface SubmitClipOutcome {
  error: string | null;
}

/** El período objetivo es "el mensual en draft más reciente" — se asume como mucho uno
 * vivo a la vez (mismo criterio operativo que getCurrentVotingPeriod), igual que
 * ANTES de esto no había ningún envío público con el que confundirse. */
async function findOpenMonthlyDraftPeriod() {
  const [period] = await db
    .select()
    .from(awardPeriods)
    .where(and(eq(awardPeriods.cycle, "monthly"), eq(awardPeriods.status, "draft")))
    .orderBy(desc(awardPeriods.createdAt))
    .limit(1);
  return period ?? null;
}

export async function submitPointOfMonthClip(formData: FormData): Promise<SubmitClipOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) return { error: "Link your player profile before submitting a clip." };

  // Generoso (5/hora) — un jugador real envía esto un puñado de veces al mes como
  // mucho; el límite es contra spamear la cola de revisión del admin, no contra el uso
  // legítimo (mismo criterio que requestPlayerClaim, app/account/actions.ts).
  if (await isRateLimited(`award-clip-submit:${user.id}`, 60 * 60 * 1000, 5)) {
    return { error: "Too many submissions — try again later." };
  }

  const clipUrl = String(formData.get("clipUrl") ?? "").trim();
  const matchIdRaw = String(formData.get("matchId") ?? "").trim();
  const matchId = matchIdRaw ? Number(matchIdRaw) : null;
  const caption = String(formData.get("caption") ?? "").trim() || null;
  if (!clipUrl) return { error: "Paste a link to your clip first." };
  if (clipUrl.length > MAX_CLIP_URL_LENGTH) return { error: "That link is too long." };
  if (!/^https?:\/\//i.test(clipUrl)) return { error: "That doesn't look like a valid link — it should start with http:// or https://." };
  // point_of_month es nomineeKind 'player_in_match' (lib/awards/catalog.ts) — un punto
  // siempre pasó EN un partido concreto, pedido explícito: obligatorio, no opcional.
  if (!matchId) return { error: "Pick which match this point was from." };

  const period = await findOpenMonthlyDraftPeriod();
  if (!period) return { error: "There's no submission window open right now — check back once next month's awards period opens." };

  const existingPending = await db
    .select({ id: awardNominations.id })
    .from(awardNominations)
    .where(and(eq(awardNominations.periodId, period.id), eq(awardNominations.submittedByUserId, user.id), eq(awardNominations.status, "pending")));
  if (existingPending.length >= MAX_PENDING_SUBMISSIONS_PER_PERIOD) {
    return { error: "You've already submitted the maximum number of clips for this period." };
  }

  await db.insert(awardNominations).values({
    periodId: period.id,
    categoryKey: "point_of_month",
    playerId,
    matchId,
    clipUrl,
    caption,
    status: "pending",
    submittedByUserId: user.id,
  });

  revalidatePath("/account");
  return { error: null };
}

export interface MyPendingSubmission {
  id: number;
  caption: string | null;
  clipUrl: string | null;
  createdAt: Date;
}

export async function getMyPendingPointOfMonthSubmissions(): Promise<MyPendingSubmission[]> {
  const user = await requireUser();
  return db
    .select({ id: awardNominations.id, caption: awardNominations.caption, clipUrl: awardNominations.clipUrl, createdAt: awardNominations.createdAt })
    .from(awardNominations)
    .where(and(eq(awardNominations.submittedByUserId, user.id), eq(awardNominations.status, "pending")))
    .orderBy(desc(awardNominations.createdAt));
}

/** Buscador de partido para el propio formulario de envío — a diferencia del del
 * admin (app/admin/awards/actions.ts::searchMatchCandidatesForPeriod, cualquier
 * partido del período), este se acota ADEMÁS a partidos en los que el propio jugador
 * jugó: no tendría sentido dejar que alguien etiquete un punto suyo en un partido
 * ajeno. Mismo filtro de fecha compartido (lib/awards/queries.ts::periodDateFilter). */
export async function searchMyMatchCandidates(query: string): Promise<MatchCandidateOption[]> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const period = await findOpenMonthlyDraftPeriod();
  if (!period) return [];

  const p1 = alias(players, "award_my_match_p1");
  const p2 = alias(players, "award_my_match_p2");
  const like = `%${q}%`;

  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      player1Id: matches.player1Id,
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
    .where(
      and(
        periodDateFilter(period),
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)),
        or(ilike(p1.displayName, like), ilike(p2.displayName, like), ilike(events.displayName, like)),
      ),
    )
    .limit(24);

  const seen = new Set<number>();
  const deduped = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, 8);

  return deduped.map((r) => {
    const opponent = r.player1Id === playerId ? r.player2 : r.player1;
    return { id: r.id, label: `vs ${opponent} — ${r.eventName} ${r.year} (${r.round})` };
  });
}
