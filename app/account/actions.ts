"use server";

import { z } from "zod";
import { and, asc, desc, eq, ilike, isNull, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { authUsers, players, playerClaimRequests, playerKnownNames, playerBuilds, news, newsPlayers, newsReporterRequests } from "@/db/schema";
import { requireUser, getLinkedPlayerId } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { slugify, uniqueSlug, parsePlayerIds } from "@/lib/newsSlug";
import { rehostImageIfExternal } from "@/lib/newsImage";
import { uploadImageToMediaStorage } from "@/lib/mediaStorage";
import { NEWS_CATEGORIES } from "@/lib/newsCategories";
import { sanitizeRichText, isRichTextEmpty } from "@/lib/richText";
import { getMyRecentStats, type MyRecentStats } from "@/lib/statsQueries";
import { getCareerStats } from "@/lib/h2hStats";
import { parseMyStatsWindow } from "@/lib/myStatsWindow";
import { extractBuildFromScreenshot, type ExtractedBuildStats } from "@/lib/buildScreenshotOcr";
import {
  ACCELERATION_TRAITS,
  ALL_STAT_KEYS,
  ARCHETYPES,
  MAX_BUILDS_PER_PLAYER,
  MAX_BUILD_NAME_LENGTH,
  MAX_OUTFIT_CODE_LENGTH,
  type AccelerationTrait,
  type Archetype,
  type StatKey,
} from "@/lib/buildStats";
import { computeBuildPoints, VALID_REMAINING_POINTS } from "@/lib/buildPoints";

/** Tamaño máximo del data URI ya codificado (base64 incluido) — defensa en profundidad
 * detrás del redimensionado en el cliente (components/account/AvatarUpload.tsx, que ya
 * limita a 320x320 y comprime): nadie puede colar una imagen enorme saltándose el
 * cliente (DevTools, llamada directa a la Server Action). ~500KB de sobra para una
 * foto de perfil pequeña ya comprimida. */
const MAX_AVATAR_DATA_URI_LENGTH = 500_000;

export interface ClaimablePlayerRow {
  id: number;
  displayName: string;
  country: string | null;
}

/**
 * Candidatos para reclamar — cualquier `players` sin dueño y sin una solicitud
 * 'pending' ya en curso de otra persona. Sin `requireAdmin`: cualquier usuario
 * logueado puede buscar (a diferencia de app/admin/players/actions.ts::searchPlayers,
 * que es la versión de admin, sin este filtro).
 */
export async function searchClaimablePlayers(q: string): Promise<ClaimablePlayerRow[]> {
  await requireUser();
  if (q.trim().length < 2) return [];

  const pendingPlayerIds = db.select({ id: playerClaimRequests.playerId }).from(playerClaimRequests).where(eq(playerClaimRequests.status, "pending"));

  return db
    .select({ id: players.id, displayName: players.displayName, country: players.country })
    .from(players)
    .where(
      and(
        isNull(players.linkedUserId),
        // Un admin ya propuso este jugador para otra cuenta (players.pendingLinkUserId,
        // ver db/schema.ts) — fuera de la búsqueda manual mientras esa propuesta siga
        // sin resolver, para que dos personas distintas no puedan acabar reclamando el
        // mismo perfil por dos caminos a la vez.
        isNull(players.pendingLinkUserId),
        notInArray(players.id, pendingPlayerIds),
        ilike(players.displayName, `%${q.trim()}%`),
      ),
    )
    .orderBy(asc(players.displayName))
    .limit(20);
}

/** Mínimo de caracteres para que CUALQUIERA de los dos nombres cuente en la
 * comparación "uno contiene al otro" (ver `namesRelate`) — sin esto, un nombre de
 * Discord de dos letras coincidiría por contención con medio directorio de jugadores.
 * La igualdad EXACTA no pasa por este mínimo (un nombre corto de verdad, tipo "Kay",
 * sigue pudiendo autosugerirse). */
const MIN_LENGTH_FOR_SUBSTRING_MATCH = 3;

function namesRelate(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < MIN_LENGTH_FOR_SUBSTRING_MATCH || b.length < MIN_LENGTH_FOR_SUBSTRING_MATCH) return false;
  return a.includes(b) || b.includes(a);
}

export interface SuggestedClaimMatch extends ClaimablePlayerRow {
  currentRank: number | null;
  careerWins: number;
  careerLosses: number;
  careerTitles: number;
}

/**
 * Intenta encontrar solo/a el perfil de quien acaba de entrar, comparando su nombre de
 * Discord (`authUsers.name`, tal cual lo da el proveedor OAuth) contra el nombre — o un
 * nombre conocido — de un `players` todavía sin dueño. Pedido explícito: "the website
 * tries to automatically find the right account" al iniciar sesión, con un "Is this
 * your profile?" antes de pedir nada — nunca vincula por sí sola, solo decide si
 * enseñar ese aviso o caer directo al buscador manual de siempre
 * (ClaimPlayerSearch.tsx).
 *
 * Igualdad exacta O uno de los dos nombres contiene al otro (p.ej. Discord "gyr" con
 * jugador "Gyrmik") — pedido explícito tras ver que la coincidencia exacta a secas se
 * quedaba corta en casos reales así: la aprobación del admin sigue siendo el filtro de
 * verdad contra sugerir la identidad equivocada, así que aquí se puede permitir más
 * margen sin bajar la guardia de fondo. La comparación de contención se hace en código,
 * nunca con `LIKE`/`ILIKE` contra el nombre tal cual — un guion bajo, nada raro en un
 * nombre de Discord ("rammm_", "meet_bagga"...), es un comodín de un solo carácter en
 * LIKE/ILIKE y habría colado coincidencias falsas por accidente, no por contención real.
 * Cero candidatos, o más de uno (nombre duplicado o varios parecidos), y no se sugiere
 * nada — solo un candidato inequívoco cuenta, sea cual sea el criterio que lo encontró.
 */
export async function getSuggestedClaimMatch(): Promise<SuggestedClaimMatch | null> {
  const user = await requireUser();
  if (!user.name) return null;

  const alreadyLinked = await getLinkedPlayerId(user.id);
  if (alreadyLinked) return null;

  const normalizedName = user.name.trim().toLowerCase();
  if (!normalizedName) return null;

  const pendingPlayerIds = db.select({ id: playerClaimRequests.playerId }).from(playerClaimRequests).where(eq(playerClaimRequests.status, "pending"));

  // `isNull(players.pendingLinkUserId)`: un admin ya propuso este jugador para otra
  // cuenta (ver db/schema.ts) — fuera de la autosugerencia mientras esa propuesta
  // siga sin resolver, mismo motivo que searchClaimablePlayers.
  const [candidatePlayers, candidateKnownNames] = await Promise.all([
    db
      .select({ id: players.id, displayName: players.displayName, country: players.country })
      .from(players)
      .where(and(isNull(players.linkedUserId), isNull(players.pendingLinkUserId), notInArray(players.id, pendingPlayerIds))),
    db
      .select({ id: players.id, displayName: players.displayName, country: players.country, knownName: playerKnownNames.name })
      .from(playerKnownNames)
      .innerJoin(players, eq(players.id, playerKnownNames.playerId))
      .where(and(isNull(players.linkedUserId), isNull(players.pendingLinkUserId), notInArray(players.id, pendingPlayerIds))),
  ]);

  const uniqueById = new Map<number, ClaimablePlayerRow>();
  for (const p of candidatePlayers) {
    if (namesRelate(normalizedName, p.displayName.trim().toLowerCase())) uniqueById.set(p.id, p);
  }
  for (const k of candidateKnownNames) {
    if (namesRelate(normalizedName, k.knownName.trim().toLowerCase())) {
      uniqueById.set(k.id, { id: k.id, displayName: k.displayName, country: k.country });
    }
  }
  if (uniqueById.size !== 1) return null;

  const match = [...uniqueById.values()][0];
  const stats = await getCareerStats(match.id, new Date().getFullYear());
  return {
    ...match,
    currentRank: stats.currentRank,
    careerWins: stats.careerWins,
    careerLosses: stats.careerLosses,
    careerTitles: stats.careerTitles,
  };
}

/**
 * Un admin (con ayuda de IA, ver lib/adminLinkSuggestions.ts) ya propuso un vínculo
 * para ESTA cuenta — `players.pendingLinkUserId`, nunca `linkedUserId` todavía (ver el
 * comentario de esa columna en db/schema.ts). Tiene prioridad sobre
 * `getSuggestedClaimMatch`: si un admin ya lo revisó, no hace falta además la
 * autosugerencia por nombre — las dos comparten el mismo pop-up "Is this your
 * profile?" (components/account/ClaimSuggestion.tsx), solo cambia a qué Server Action
 * llama "Yes".
 */
export async function getPendingAdminLinkSuggestion(): Promise<SuggestedClaimMatch | null> {
  const user = await requireUser();

  const alreadyLinked = await getLinkedPlayerId(user.id);
  if (alreadyLinked) return null;

  const [match] = await db
    .select({ id: players.id, displayName: players.displayName, country: players.country })
    .from(players)
    .where(eq(players.pendingLinkUserId, user.id));
  if (!match) return null;

  const stats = await getCareerStats(match.id, new Date().getFullYear());
  return {
    ...match,
    currentRank: stats.currentRank,
    careerWins: stats.careerWins,
    careerLosses: stats.careerLosses,
    careerTitles: stats.careerTitles,
  };
}

/** "Yes, that's me" sobre una propuesta de admin — a diferencia de
 * `requestPlayerClaim`, esto vincula YA MISMO: el admin ya hizo su parte al
 * proponerlo, lo único que faltaba era que el propio jugador lo confirmara. Vuelve a
 * comprobar que la propuesta sigue siendo para ESTA cuenta antes de vincular
 * (protección de carrera: un admin podría haber cancelado la propuesta justo antes). */
export async function confirmPendingLink(playerId: number): Promise<void> {
  const user = await requireUser();
  if (!Number.isInteger(playerId)) return;

  const [target] = await db.select({ pendingLinkUserId: players.pendingLinkUserId }).from(players).where(eq(players.id, playerId));
  if (!target || target.pendingLinkUserId !== user.id) return;

  await db.update(players).set({ linkedUserId: user.id, pendingLinkUserId: null, avatarUrl: user.image }).where(eq(players.id, playerId));

  revalidatePath("/account");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/rankings");
}

/** "No, that's not me" sobre una propuesta de admin — nunca llegó a vincularse de
 * verdad, así que no hay nada que "desvincular": solo se limpia la propuesta y cae al
 * buscador manual de siempre. */
export async function rejectPendingLink(playerId: number): Promise<void> {
  const user = await requireUser();
  if (!Number.isInteger(playerId)) return;

  const [target] = await db.select({ pendingLinkUserId: players.pendingLinkUserId }).from(players).where(eq(players.id, playerId));
  if (!target || target.pendingLinkUserId !== user.id) return;

  await db.update(players).set({ pendingLinkUserId: null }).where(eq(players.id, playerId));
  revalidatePath("/account");
}

/**
 * "My Stats" en /account con un periodo elegible (pedido explícito, antes fijo a 90
 * días) — SIEMPRE sobre el jugador de la propia sesión, nunca un `playerId` que venga
 * del cliente: es la única forma de que esto sea seguro de exponer como Server Action
 * (cualquiera podría llamarla directamente con cualquier id si lo aceptara).
 */
export async function fetchMyRecentStats(rawWindow: string): Promise<MyRecentStats | null> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) return null;

  return getMyRecentStats(playerId, parseMyStatsWindow(rawWindow));
}

/**
 * Pide vincularse a un `players` YA EXISTENTE — SIEMPRE queda 'pending' hasta que un
 * admin lo apruebe o rechace (app/admin/players/claims/actions.ts), nunca se
 * auto-aprueba. No existe un camino para crear un `players` nuevo desde la web: todo el
 * que juega en el tour ya está aquí, importado del foro de Mana Games — "crear un
 * perfil" inventaría un jugador que el foro no reconoce. Un usuario no puede tener más
 * de una solicitud pendiente ni un jugador ya vinculado a la vez — comprobado aquí, no
 * hay restricción de esquema para esto.
 */
export async function requestPlayerClaim(playerId: number): Promise<void> {
  const user = await requireUser();

  // Generoso a propósito (5/hora) — un jugador real solo manda esto un puñado de veces
  // en su vida; el límite es contra alguien con varias cuentas desechables intentando
  // llenar la cola de revisión del admin gratis, no contra el uso legítimo.
  if (await isRateLimited(`claim:${user.id}`, 60 * 60 * 1000, 5)) return;

  const alreadyLinked = await getLinkedPlayerId(user.id);
  if (alreadyLinked) return;

  const [existingPending] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.userId, user.id), eq(playerClaimRequests.status, "pending")));
  if (existingPending) return;

  const [target] = await db.select({ linkedUserId: players.linkedUserId }).from(players).where(eq(players.id, playerId));
  if (!target || target.linkedUserId) return;

  const [targetPending] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.playerId, playerId), eq(playerClaimRequests.status, "pending")));
  if (targetPending) return;

  await db.insert(playerClaimRequests).values({ playerId, userId: user.id, status: "pending" });
  // Sin `revalidatePath("/account")` a propósito — la página ya es `force-dynamic`
  // (lee la sesión), así que ya sale fresca en cuanto alguien navegue de verdad ahí.
  // Con el revalidate, el propio Server Action disparaba un re-render instantáneo de
  // la página EN CURSO en la misma transición del clic — quien pedía el vínculo desde
  // el pop-up (ClaimSuggestion.tsx) o desde el buscador (ClaimPlayerSearch.tsx) nunca
  // llegaba a ver el "Request sent" de ninguno de los dos: la página entera cambiaba a
  // la vista de "Request pending" (app/account/page.tsx) antes de que React pintara
  // ese mensaje. Bug real reportado con captura.
}

const MAX_MEMBER_BIO_LENGTH = 500;

/** Bio de una cuenta SIN jugador del tour vinculado todavía — ver
 * lib/memberProfile.ts/app/members/[userId]/page.tsx. Un jugador ya vinculado sigue
 * editando la suya en players.bio (components/account/PlayerProfileForm.tsx), nunca
 * esta — las dos columnas son intencionalmente independientes, no hay migración de una
 * a otra al reclamar un perfil (pedido explícito: mantenerlo simple, no una fuente de
 * verdad que "se mueve" de un lado a otro). */
export async function updateMemberBio(formData: FormData): Promise<{ error: string | null }> {
  const user = await requireUser();

  const bioRaw = String(formData.get("bio") ?? "").trim();
  if (bioRaw.length > MAX_MEMBER_BIO_LENGTH) return { error: `Bio is limited to ${MAX_MEMBER_BIO_LENGTH} characters.` };

  await db.update(authUsers).set({ bio: bioRaw || null }).where(eq(authUsers.id, user.id));
  revalidatePath("/account");
  return { error: null };
}

export interface ReporterStatus {
  isReporter: boolean;
  pendingRequest: boolean;
  /** Solo matiza el mensaje ("tu solicitud anterior no se aprobó") — un rechazo NUNCA
   * bloquea volver a pedirlo, solo una solicitud ya 'pending' lo hace. */
  wasRejected: boolean;
}

/** Estado de la propia cuenta respecto al programa de reporteros — para que
 * app/account/page.tsx decida qué enseñar (botón de pedir, aviso de pendiente, o el
 * formulario de escribir) sin repetir esta consulta en cada sitio donde hace falta. */
export async function getMyReporterStatus(): Promise<ReporterStatus> {
  const user = await requireUser();

  const [account] = await db.select({ isReporter: authUsers.isReporter }).from(authUsers).where(eq(authUsers.id, user.id));
  if (account?.isReporter) return { isReporter: true, pendingRequest: false, wasRejected: false };

  const [latest] = await db
    .select({ status: newsReporterRequests.status })
    .from(newsReporterRequests)
    .where(eq(newsReporterRequests.userId, user.id))
    .orderBy(desc(newsReporterRequests.requestedAt))
    .limit(1);

  return { isReporter: false, pendingRequest: latest?.status === "pending", wasRejected: latest?.status === "rejected" };
}

/**
 * Pide poder escribir noticias propias — SIEMPRE queda 'pending' hasta que un admin
 * lo apruebe o rechace (app/admin/news/reporters/actions.ts), nunca se auto-aprueba.
 * A diferencia de requestPlayerClaim (que exige NO tener ya un jugador vinculado),
 * ser reportero no depende para nada de tener perfil de jugador — cualquier cuenta
 * logueada puede pedirlo. Un rechazo anterior no bloquea un nuevo intento, solo una
 * solicitud ya 'pending' lo hace.
 */
export async function requestNewsReporter(): Promise<void> {
  const user = await requireUser();

  // Igual de generoso que requestPlayerClaim: el límite es contra spamear la cola de
  // revisión del admin, no contra el uso legítimo.
  if (await isRateLimited(`reporter-request:${user.id}`, 60 * 60 * 1000, 5)) return;

  const [account] = await db.select({ isReporter: authUsers.isReporter }).from(authUsers).where(eq(authUsers.id, user.id));
  if (account?.isReporter) return;

  const [existingPending] = await db
    .select({ id: newsReporterRequests.id })
    .from(newsReporterRequests)
    .where(and(eq(newsReporterRequests.userId, user.id), eq(newsReporterRequests.status, "pending")));
  if (existingPending) return;

  await db.insert(newsReporterRequests).values({ userId: user.id, status: "pending" });
  revalidatePath("/account");
}

export interface SubmitReporterStoryOutcome {
  error: string | null;
}

/**
 * Envío de una noticia propia por un reportero ya aprobado — nace SIEMPRE en 'draft'
 * y sin `autoKey` (eso es solo de lo generado por IA, ver db/schema.ts::news), así que
 * un admin la revisa y publica por el mismo camino que cualquier otro borrador
 * (app/admin/actions.ts::saveNews) — nunca sale a portada sola. Un reportero SÍ puede
 * usar "Enhance with AI" en su propio borrador (components/account/ReporterStoryForm.tsx,
 * app/admin/news/actions.ts::enhanceNewsDraft) desde que se cambió ese generador de
 * "la IA decide el tema y escribe sola" a "pule un borrador que el propio reportero ya
 * decidió" (pedido explícito, 2026-09-15) — nunca tiene acceso a elegir el tema por su
 * cuenta, solo a pulir lo que él mismo ya escribió.
 */
export async function submitReporterStory(formData: FormData): Promise<SubmitReporterStoryOutcome> {
  const user = await requireUser();

  const [account] = await db.select({ isReporter: authUsers.isReporter }).from(authUsers).where(eq(authUsers.id, user.id));
  if (!account?.isReporter) return { error: "You're not an approved reporter." };

  // Más generoso que el límite de aprobación (10/hora, no 5) — un reportero de verdad
  // puede mandar varias crónicas en una sesión activa, el límite es solo contra spam.
  if (await isRateLimited(`reporter-story:${user.id}`, 60 * 60 * 1000, 10)) {
    return { error: "Too many submissions — try again later." };
  }

  // Igual que MAX_PENDING_SUBMISSIONS_PER_PERIOD en Point of the Month: el límite por
  // hora de arriba se resetea solo, así que por sí solo no evita que alguien llene la
  // cola de revisión del admin con borradores sin límite. Uno todavía sin decidir
  // (`draft`, nunca `published`) cuenta; publicados no, esos ya están resueltos.
  const [{ count: pendingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(news)
    .where(and(eq(news.submittedByUserId, user.id), eq(news.status, "draft")));
  if (pendingCount >= 5) {
    return { error: "You already have 5 submissions waiting for review — wait for those to be reviewed first." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = sanitizeRichText(String(formData.get("body") ?? ""));
  const category = String(formData.get("category") ?? "REPORT");
  const imageUrl = await rehostImageIfExternal(String(formData.get("imageUrl") ?? "").trim() || null);
  const editionRaw = String(formData.get("editionId") ?? "").trim();
  const editionId = editionRaw ? Number(editionRaw) : null;
  const playerIds = parsePlayerIds(String(formData.get("playerIds") ?? ""));

  if (!title || !excerpt || isRichTextEmpty(body)) {
    return { error: "Headline, standfirst, and body are all required." };
  }

  const slug = await uniqueSlug(slugify(title), null);
  const [created] = await db
    .insert(news)
    .values({
      slug,
      title,
      excerpt,
      body,
      author: user.name,
      category: (NEWS_CATEGORIES as readonly string[]).includes(category) ? category : "REPORT",
      imageUrl,
      editionId: editionId && Number.isInteger(editionId) ? editionId : null,
      status: "draft",
      submittedByUserId: user.id,
    })
    .returning({ id: news.id });

  if (playerIds.length > 0) {
    await db.insert(newsPlayers).values(playerIds.map((playerId) => ({ newsId: created.id, playerId })));
  }

  revalidatePath("/account");
  return { error: null };
}

export interface MyNewsSubmission {
  id: number;
  title: string;
  status: string;
  createdAt: Date;
}

/** Solo las propias — para que el reportero vea qué mandó y si ya se publicó, sin
 * poder ver ni tocar lo de nadie más (a diferencia de getNewsListRows, admin-only). */
export async function getMyNewsSubmissions(): Promise<MyNewsSubmission[]> {
  const user = await requireUser();
  return db
    .select({ id: news.id, title: news.title, status: news.status, createdAt: news.createdAt })
    .from(news)
    .where(eq(news.submittedByUserId, user.id))
    .orderBy(desc(news.createdAt));
}

export interface UploadAvatarOutcome {
  error: string | null;
}

/**
 * Guarda una foto subida a mano — pedido explícito: el avatar de Discord tarda hasta
 * el siguiente login en refrescarse (evento `signIn` de auth.ts), así que una foto
 * propia le da al jugador control inmediato sin depender de esa sincronización.
 *
 * `dataUri` ya viene redimensionada y comprimida por el cliente
 * (components/account/AvatarUpload.tsx) — aquí solo se revalida forma y tamaño, nunca
 * se reprocesa la imagen server-side (no hace falta una librería de imágenes nueva
 * para algo tan pequeño). Hasta el 2026-09-20 se guardaba el data URI TAL CUAL en
 * `players.avatarUrl` — bug real de ancho de banda: sin URL propia que cachear, se
 * retransmitía entero en cada tabla/ficha que enseñara ese avatar, para siempre.
 * Ahora se sube a Cloudflare R2 (lib/mediaStorage.ts) y solo se guarda la URL real.
 */
export async function uploadAvatar(dataUri: string): Promise<UploadAvatarOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  const match = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(dataUri);
  if (!match) {
    return { error: "That doesn't look like an image — try a different file." };
  }
  if (dataUri.length > MAX_AVATAR_DATA_URI_LENGTH) {
    return { error: "Image is too large even after compression — try a smaller photo." };
  }

  const contentType = match[1];
  const buffer = Buffer.from(dataUri.slice(match[0].length), "base64");
  let avatarUrl: string;
  try {
    avatarUrl = await uploadImageToMediaStorage(buffer, contentType, "avatars");
  } catch (err) {
    console.error("✗ No se pudo subir el avatar a R2:", err);
    return { error: "Couldn't upload the image right now — try again in a moment." };
  }

  await db.update(players).set({ avatarUrl, avatarIsCustom: true }).where(eq(players.id, playerId));

  revalidatePath("/rankings");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
  return { error: null };
}

/**
 * Vuelve al avatar de Discord — deja de estar "bloqueado" (`avatarIsCustom: false`, ver
 * db/schema.ts) para que el evento `signIn` de auth.ts vuelva a sincronizarlo en cada
 * login, y de paso lo resincroniza YA MISMO con `user.image` de la sesión actual en vez
 * de esperar al siguiente login — la única forma de que "quitar la foto propia" se
 * sienta inmediata también.
 */
export async function removeCustomAvatar(): Promise<void> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  await db.update(players).set({ avatarUrl: user.image, avatarIsCustom: false }).where(eq(players.id, playerId));

  revalidatePath("/rankings");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
}

/**
 * "I'm not on PC, stop reminding me" del popup de MatchLog
 * (components/account/MatchLogReminderToast.tsx) — permanente por cuenta (ver
 * comentario de `authUsers.matchLogReminderOptedOut` en db/schema.ts), así que no
 * hace falta volver a preguntar en otro dispositivo. Sin `revalidatePath`: el propio
 * popup se cierra de inmediato en el cliente al marcar la casilla, no depende de que
 * la página se vuelva a renderizar.
 */
export async function dismissMatchLogReminder(): Promise<void> {
  const user = await requireUser();
  await db.update(authUsers).set({ matchLogReminderOptedOut: true }).where(eq(authUsers.id, user.id));
}

function emptyToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

const HANDLE_RE = /^[A-Za-z0-9._]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Único formulario del sitio que de verdad sigue la regla de CLAUDE.md §2 ("Zod para
 * validación en los límites") al pie de la letra — el resto de Server Actions de este
 * fichero se quedó en comprobaciones a mano (ver `uploadAvatar` más arriba), pero un
 * formulario de 8 campos no debería repetir esa deriva.
 *
 * Cada campo de texto pasa por `emptyToNull` antes de validar: un `<input>` vacío
 * manda "", nunca `null`, y "sin rellenar" tiene que significar lo mismo que "nunca
 * se guardó nada" en `players` (columna en NULL, se omite en la ficha pública).
 */
const PlayerProfileSchema = z
  .object({
    bio: z.preprocess(emptyToNull, z.string().max(500, "Keep the bio under 500 characters.").nullable()),
    realName: z.preprocess(emptyToNull, z.string().max(80, "That name is too long.").nullable()),
    birthDate: z.preprocess(emptyToNull, z.string().regex(DATE_RE, "Enter a valid date.").nullable()),
    playstyle: z.preprocess(emptyToNull, z.enum(["right-handed", "left-handed"]).nullable()),
    clothingBrand: z.preprocess(emptyToNull, z.string().max(60, "That's too long.").nullable()),
    racketBrand: z.preprocess(emptyToNull, z.string().max(60, "That's too long.").nullable()),
    instagramHandle: z.preprocess(
      emptyToNull,
      z.string().max(60).regex(HANDLE_RE, "Letters, numbers, dots and underscores only.").nullable(),
    ),
    youtubeUrl: z.preprocess(emptyToNull, z.string().max(300).url("Enter a valid URL.").nullable()),
  })
  .refine((data) => data.birthDate === null || new Date(data.birthDate).getTime() <= Date.now(), {
    message: "Birth date can't be in the future.",
    path: ["birthDate"],
  });

export interface UpdatePlayerProfileInput {
  bio: string | null;
  realName: string | null;
  /** "YYYY-MM-DD" or null — matches what an `<input type="date">` gives back. */
  birthDate: string | null;
  playstyle: "right-handed" | "left-handed" | null;
  clothingBrand: string | null;
  racketBrand: string | null;
  instagramHandle: string | null;
  youtubeUrl: string | null;
}

export interface UpdatePlayerProfileOutcome {
  error: string | null;
}

/**
 * Todos los campos son opcionales y se omiten en la ficha pública cuando están
 * vacíos — no hay un toggle de visibilidad por campo, el propio jugador ya decide
 * qué enseña con lo que rellena (`realName` en particular, explícitamente opcional).
 */
export async function updatePlayerProfile(input: UpdatePlayerProfileInput): Promise<UpdatePlayerProfileOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  const parsed = PlayerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That doesn't look right — try again." };
  }

  await db.update(players).set(parsed.data).where(eq(players.id, playerId));

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
  return { error: null };
}

/** Igual que `emptyToNull`, para una casilla numérica: un `<input type="number">`
 * vacío manda "" igual que uno de texto — "sin rellenar" tiene que seguir
 * significando NULL, nunca 0 (0% de algo y "no rellenado todavía" no son lo mismo). */
/**
 * A propósito SIN `emptyToNull`: ese preprocesador es para campos de texto de
 * `<input>` normales, donde "vacío" llega como `""` — PlayerBuildForm.tsx no manda
 * eso, manda `number | null` directamente (llama a la Server Action con un objeto ya
 * tipado, no un FormData de un `<form>`), y `emptyToNull` trata cualquier cosa que no
 * sea ya un string como "vacío" — incluido un número real. Con `emptyToNull` puesto
 * aquí, TODO stat se guardaba como NULL en cada guardado, pasase lo que pasase (bug
 * real confirmado: un build que el jugador veía en 772 puntos por pantalla se
 * guardaba con las 22 estadísticas en null, y `computeBuildPoints` sobre puros nulls
 * daba el presupuesto entero, 2800, en vez de 772).
 */
function statPct(label: string) {
  return z.coerce.number().int().min(0, `${label} must be between 0 and 100.`).max(100, `${label} must be between 0 and 100.`).nullable();
}

/**
 * Ficha de "Build" del juego (db/schema.ts::playerBuilds) — todas las estadísticas
 * son opcionales, igual criterio que PlayerProfileSchema: el jugador puede guardar
 * solo unas pocas casillas o solo la imagen (ver `uploadBuildImage` más abajo).
 * `points` NO forma parte de esta schema a propósito — se calcula en el servidor
 * (`computeBuildPoints`), nunca se acepta lo que mande el cliente para ese campo.
 */
const PlayerBuildSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your build a name.")
    .max(MAX_BUILD_NAME_LENGTH, `Keep the name under ${MAX_BUILD_NAME_LENGTH} characters.`),
  archetype: z.preprocess(emptyToNull, z.enum(ARCHETYPES).nullable()),
  accelerationTrait: z.preprocess(emptyToNull, z.enum(ACCELERATION_TRAITS).nullable()),
  outfitCode: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(MAX_OUTFIT_CODE_LENGTH, `Keep the outfit code under ${MAX_OUTFIT_CODE_LENGTH} characters.`)
      .nullable(),
  ),
  forehandPower: statPct("Forehand power"),
  forehandConsistency: statPct("Forehand consistency"),
  forehandPrecision: statPct("Forehand precision"),
  backhandPower: statPct("Backhand power"),
  backhandConsistency: statPct("Backhand consistency"),
  backhandPrecision: statPct("Backhand precision"),
  servicePower: statPct("Service power"),
  serviceConsistency: statPct("Service consistency"),
  servicePrecision: statPct("Service precision"),
  forehandVolley: statPct("Forehand volley"),
  backhandVolley: statPct("Backhand volley"),
  smash: statPct("Smash"),
  netPresence: statPct("Net presence"),
  focus: statPct("Focus"),
  counter: statPct("Counter"),
  lob: statPct("Lob"),
  dropShot: statPct("Drop shot"),
  topSpin: statPct("Top spin"),
  speed: statPct("Speed"),
  stamina: statPct("Stamina"),
  muscleTone: statPct("Muscle tone"),
  visibleStats: z.array(z.enum(ALL_STAT_KEYS)).default([]),
  isPublic: z.boolean(),
});

export type UpdatePlayerBuildInput = {
  name: string;
  archetype: Archetype | null;
  accelerationTrait: AccelerationTrait | null;
  outfitCode: string | null;
  visibleStats: StatKey[];
  isPublic: boolean;
} & Record<Exclude<StatKey, "topSpin"> | "topSpin", number | null>;

export interface UpdatePlayerBuildOutcome {
  error: string | null;
}

/** Reutilizado por cada acción de abajo que recibe un `buildId` desde el cliente —
 * nunca se confía en que de verdad pertenezca al jugador de la sesión, siempre se
 * comprueba contra la base de datos primero. */
async function requireOwnedBuild(playerId: number, buildId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: playerBuilds.id })
    .from(playerBuilds)
    .where(and(eq(playerBuilds.id, buildId), eq(playerBuilds.playerId, playerId)));
  return Boolean(row);
}

export interface CreatePlayerBuildOutcome {
  buildId: number | null;
  error: string | null;
}

/**
 * Hasta MAX_BUILDS_PER_PLAYER (lib/buildStats.ts) — pedido explícito, "create a
 * maximum of 3 uploaded builds". La build nace en blanco, sin estadísticas ni
 * imagen — el jugador la rellena después con `updatePlayerBuild`/`uploadBuildImage`.
 * La primera build de un jugador nace ya "in use" (nadie debería quedarse sin
 * ninguna build activa nada más crear la primera); las siguientes nacen apagadas, el
 * jugador elige cuál activar con `setBuildInUse`.
 */
export async function createPlayerBuild(name: string): Promise<CreatePlayerBuildOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  const trimmed = name.trim();
  if (trimmed.length === 0) return { buildId: null, error: "Give your build a name." };
  if (trimmed.length > MAX_BUILD_NAME_LENGTH) {
    return { buildId: null, error: `Keep the name under ${MAX_BUILD_NAME_LENGTH} characters.` };
  }

  const existing = await db.select({ id: playerBuilds.id }).from(playerBuilds).where(eq(playerBuilds.playerId, playerId));
  if (existing.length >= MAX_BUILDS_PER_PLAYER) {
    return { buildId: null, error: `You can only keep up to ${MAX_BUILDS_PER_PLAYER} builds — delete one first.` };
  }

  const [created] = await db
    .insert(playerBuilds)
    .values({ playerId, name: trimmed, inUse: existing.length === 0 })
    .returning({ id: playerBuilds.id });

  revalidatePath("/account");
  return { buildId: created.id, error: null };
}

export interface DeletePlayerBuildOutcome {
  error: string | null;
}

/**
 * Si la build borrada era la "in use" y quedan otras, asciende la editada más
 * recientemente — juicio propio, no pedido explícitamente: dejar la ficha pública sin
 * ninguna build activa de la nada sería peor sorpresa que elegir una por el jugador.
 */
export async function deletePlayerBuild(buildId: number): Promise<DeletePlayerBuildOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  const [build] = await db
    .select({ inUse: playerBuilds.inUse })
    .from(playerBuilds)
    .where(and(eq(playerBuilds.id, buildId), eq(playerBuilds.playerId, playerId)));
  if (!build) return { error: "Build not found." };

  await db.delete(playerBuilds).where(eq(playerBuilds.id, buildId));

  if (build.inUse) {
    const [nextBuild] = await db
      .select({ id: playerBuilds.id })
      .from(playerBuilds)
      .where(eq(playerBuilds.playerId, playerId))
      .orderBy(desc(playerBuilds.updatedAt))
      .limit(1);
    if (nextBuild) await db.update(playerBuilds).set({ inUse: true }).where(eq(playerBuilds.id, nextBuild.id));
  }

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
  return { error: null };
}

export interface SetBuildInUseOutcome {
  error: string | null;
}

/**
 * Un único UPDATE marca esta build como en uso y TODAS las demás del mismo jugador
 * como no en uso a la vez — atómico a propósito: hacerlo en dos pasos (apagar todas,
 * luego encender una) dejaría un instante intermedio con cero builds en uso, que el
 * índice único parcial de db/schema.ts no detecta como problema pero es igual de
 * inválido para el propio invariante ("exactamente una").
 */
export async function setBuildInUse(buildId: number): Promise<SetBuildInUseOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  if (!(await requireOwnedBuild(playerId, buildId))) return { error: "Build not found." };

  await db
    .update(playerBuilds)
    .set({ inUse: sql`${playerBuilds.id} = ${buildId}` })
    .where(eq(playerBuilds.playerId, playerId));

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
  return { error: null };
}

/**
 * No hay forma de importar esto — es un dato local de partida-única que el juego
 * nunca expone en el foro de Mana Games, así que se guarda tal cual como lo rellene
 * el jugador. `isPublic` (apagado por defecto) decide si aparece en su ficha pública
 * — pero solo puede activarse cuando el build gasta EXACTAMENTE su presupuesto real
 * (`VALID_REMAINING_POINTS`, pedido explícito: "772 Points should always remain,
 * otherwise the build wont be valid to post"). `points` se recalcula aquí siempre,
 * nunca se guarda lo que mande el cliente para ese campo — así no hay forma de
 * falsear una build "válida" sin que las estadísticas de verdad sumen lo que toca.
 */
export async function updatePlayerBuild(buildId: number, input: UpdatePlayerBuildInput): Promise<UpdatePlayerBuildOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  if (!(await requireOwnedBuild(playerId, buildId))) return { error: "Build not found." };

  const parsed = PlayerBuildSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That doesn't look right — try again." };
  }

  const points = computeBuildPoints(parsed.data);
  if (parsed.data.isPublic && points !== VALID_REMAINING_POINTS) {
    return {
      error: `Your build must spend exactly your point budget (${VALID_REMAINING_POINTS} remaining) before it can go public — you're currently at ${points}.`,
    };
  }

  await db
    .update(playerBuilds)
    .set({ ...parsed.data, points, updatedAt: sql`now()` })
    .where(eq(playerBuilds.id, buildId));

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
  return { error: null };
}

const MAX_BUILD_IMAGE_DATA_URI_LENGTH = 500_000;
// Más grande que el recorte de arriba a propósito: esto es el screenshot COMPLETO de
// la pantalla del juego reescalado, no un recorte pequeño del personaje — de por sí
// tiene más detalle (menús, barras, fondo) que comprimir.
const MAX_ORIGINAL_SCREENSHOT_DATA_URI_LENGTH = 1_500_000;

export interface UploadBuildImageOutcome {
  error: string | null;
}

const IMAGE_DATA_URI_RE = /^data:image\/(png|jpeg|webp);base64,/;

/**
 * Guarda las dos imágenes del mismo paso de recorte a la vez: el recorte del propio
 * personaje (público, sujeto a `isPublic`) y el screenshot completo tal cual
 * (SIEMPRE privado, ver el comentario de `originalScreenshotUrl` en db/schema.ts) —
 * las dos ya vienen recortadas/comprimidas en el cliente
 * (components/account/BuildImageUpload.tsx), aquí solo se revalida forma y tamaño,
 * nunca se reprocesa la imagen server-side. Guardado aparte de `updatePlayerBuild` a
 * propósito: es su propio flujo de subir-recortar-guardar, no algo que dependa de
 * enviar el formulario de estadísticas. Actualiza una fila ya existente
 * (`requireOwnedBuild`) — a diferencia de la versión 1:1 con el jugador de antes, ya
 * no tiene sentido "crear sobre la marcha": la build tiene que existir de antes
 * (`createPlayerBuild`), esto solo le añade sus imágenes.
 */
export async function uploadBuildImage(
  buildId: number,
  characterImageUrl: string,
  originalScreenshotUrl: string,
): Promise<UploadBuildImageOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  if (!(await requireOwnedBuild(playerId, buildId))) return { error: "Build not found." };

  if (!IMAGE_DATA_URI_RE.test(characterImageUrl) || !IMAGE_DATA_URI_RE.test(originalScreenshotUrl)) {
    return { error: "That doesn't look like an image — try a different file." };
  }
  if (characterImageUrl.length > MAX_BUILD_IMAGE_DATA_URI_LENGTH) {
    return { error: "Image is too large even after cropping — try a smaller region." };
  }
  if (originalScreenshotUrl.length > MAX_ORIGINAL_SCREENSHOT_DATA_URI_LENGTH) {
    return { error: "The screenshot is too large even after compression — try a smaller file." };
  }

  await db
    .update(playerBuilds)
    .set({ characterImageUrl, originalScreenshotUrl, updatedAt: sql`now()` })
    .where(eq(playerBuilds.id, buildId));

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/account");
  return { error: null };
}

export interface ExtractBuildStatsOutcome {
  data: ExtractedBuildStats | null;
  error: string | null;
}

/**
 * Lee las estadísticas del screenshot COMPLETO (no el recorte) vía IA con visión —
 * pedido explícito: en vez de teclear 21 casillas a mano, el jugador solo revisa/
 * corrige lo que el modelo leyó. No escribe nada en la base de datos: el jugador
 * sigue teniendo que pulsar "Save build" (`updatePlayerBuild`) para que se guarde de
 * verdad, esto solo devuelve valores para rellenar el formulario.
 */
export async function extractBuildStats(dataUri: string): Promise<ExtractBuildStatsOutcome> {
  const user = await requireUser();
  const playerId = await getLinkedPlayerId(user.id);
  if (!playerId) redirect("/account");

  // Generoso a propósito (10/hora) — mismo criterio que requestPlayerClaim: un
  // jugador real puede probar varias veces con distintos ángulos/resoluciones, el
  // límite es contra abuso automatizado de una llamada a una API externa de pago.
  if (await isRateLimited(`build-ocr:${user.id}`, 60 * 60 * 1000, 10)) {
    return { data: null, error: "Too many attempts — try again in a bit." };
  }

  if (!IMAGE_DATA_URI_RE.test(dataUri)) {
    return { data: null, error: "That doesn't look like an image — try a different file." };
  }
  if (dataUri.length > MAX_ORIGINAL_SCREENSHOT_DATA_URI_LENGTH) {
    return { data: null, error: "That image is too large — try a smaller file." };
  }

  const data = await extractBuildFromScreenshot(dataUri);
  return { data, error: null };
}
